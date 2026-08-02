import type { SiteBlueprint } from '@website-generator/shared/schema';
import type {
  DeploymentPlan,
  PlanAction,
  PlanChange,
  WordPressSnapshot,
} from './types.js';

export interface DiffInput {
  readonly blueprint: SiteBlueprint;
  readonly elementorPages?: Readonly<Record<string, unknown>>;
  readonly media?: readonly { filename: string; url?: string; hash?: string }[];
  readonly snapshot: WordPressSnapshot;
  readonly menuName?: string;
  readonly setHomepage?: boolean;
  readonly siteSettings?: Readonly<Record<string, unknown>>;
}
const stable = (value: unknown): string =>
  JSON.stringify(value, (_key, val) =>
    val && typeof val === 'object' && !Array.isArray(val)
      ? Object.keys(val)
          .sort()
          .reduce<Record<string, unknown>>((x, k) => ((x[k] = val[k]), x), {})
      : val,
  );
const slug = (value: string) => value.replace(/^\/+|\/+$/g, '') || 'home';

/** Pure reusable comparator. It never holds credentials and cannot issue WordPress requests. */
export function createDeploymentPlan(input: DiffInput): DeploymentPlan {
  const changes: PlanChange[] = [];
  const add = (change: PlanChange) => changes.push(change);
  const pages = new Map(
    input.snapshot.pages.map((page) => [slug(page.slug), page]),
  );
  for (const page of input.blueprint.pages) {
    const key = slug(page.slug);
    const current = pages.get(key);
    add({
      resource: 'page',
      action: current
        ? current.title === page.title
          ? 'unchanged'
          : 'update'
        : 'create',
      identifier: key,
      label: page.title,
      safe: true,
      reason: current
        ? current.title === page.title
          ? 'Page identity and title match.'
          : 'Page title differs.'
        : 'Page does not exist.',
      before: current && {
        id: current.id,
        title: current.title,
        status: current.status,
      },
      after: { title: page.title, slug: key },
    });
    const document =
      input.elementorPages?.[page.id] ?? input.elementorPages?.[key];
    if (document !== undefined) {
      const sameDocument =
        current?.elementorDocument !== undefined &&
        stable(current.elementorDocument) === stable(document);
      add({
        resource: 'elementor',
        action: !current ? 'create' : sameDocument ? 'unchanged' : 'update',
        identifier: key,
        label: `${page.title} layout`,
        safe: true,
        reason: !current
          ? 'Elementor document will accompany the new page.'
          : sameDocument
            ? 'Elementor document matches.'
            : 'Elementor document differs.',
      });
    }
    const seo = page.seo;
    const sameSeo = current?.seo && stable(current.seo) === stable(seo);
    add({
      resource: 'seo',
      action: sameSeo ? 'unchanged' : 'update',
      identifier: key,
      label: `${page.title} SEO`,
      safe: true,
      reason: sameSeo ? 'SEO metadata matches.' : 'SEO metadata differs.',
      before: current?.seo,
      after: seo,
    });
  }
  for (const asset of input.media ?? []) {
    const current = input.snapshot.media.find(
      (x) =>
        (asset.hash && x.hash === asset.hash) || x.filename === asset.filename,
    );
    add({
      resource: 'media',
      action: current ? 'unchanged' : 'create',
      identifier: asset.filename,
      label: asset.filename,
      safe: true,
      reason: current
        ? 'Matching media is already present.'
        : 'Media needs uploading.',
    });
  }
  const desiredItems = input.blueprint.navigation.items.map((x) => ({
    title: x.label,
    url: x.href,
  }));
  const currentMenu = input.snapshot.menus.find(
    (x) => x.name === (input.menuName ?? 'Primary Navigation'),
  );
  add({
    resource: 'menu',
    action:
      currentMenu &&
      stable(currentMenu.items.map(({ title, url }) => ({ title, url }))) ===
        stable(desiredItems)
        ? 'unchanged'
        : currentMenu
          ? 'update'
          : 'create',
    identifier: input.menuName ?? 'Primary Navigation',
    label: 'Primary navigation',
    safe: true,
    reason: currentMenu
      ? 'Navigation was compared by item order, title, and URL.'
      : 'Navigation menu does not exist.',
    before: currentMenu?.items,
    after: desiredItems,
  });
  if (input.setHomepage) {
    const home =
      input.blueprint.pages.find((x) => slug(x.slug) === 'home') ??
      input.blueprint.pages[0];
    if (home) {
      const existing = pages.get(slug(home.slug));
      add({
        resource: 'homepage',
        action:
          existing &&
          input.snapshot.homepage.pageId === existing.id &&
          input.snapshot.homepage.showOnFront === 'page'
            ? 'unchanged'
            : 'configure',
        identifier: slug(home.slug),
        label: 'Static homepage',
        safe: true,
        reason: existing
          ? 'Homepage setting was compared.'
          : 'Homepage page will be created before it is selected.',
      });
    }
  }
  if (
    changes.some((x) => x.resource === 'elementor' && x.action !== 'unchanged')
  )
    add({
      resource: 'css',
      action: 'regenerate',
      identifier: 'elementor-css',
      label: 'Elementor CSS cache',
      safe: input.snapshot.elementor.active,
      reason: 'Changed Elementor documents require CSS regeneration.',
    });
  for (const [key, value] of Object.entries(input.siteSettings ?? {})) {
    const same = stable(input.snapshot.settings[key]) === stable(value);
    add({
      resource: 'settings',
      action: same ? 'unchanged' : 'configure',
      identifier: key,
      label: key,
      safe: true,
      reason: same ? 'Site setting matches.' : 'Site setting differs.',
      before: input.snapshot.settings[key],
      after: value,
    });
  }
  const actions: PlanAction[] = [
    'create',
    'update',
    'delete',
    'unchanged',
    'regenerate',
    'configure',
  ];
  const statistics = Object.fromEntries(
    actions.map((x) => [x, changes.filter((c) => c.action === x).length]),
  ) as Record<PlanAction, number> & { total: number };
  statistics.total = changes.length;
  const warnings = [
    ...(!input.snapshot.elementor.active &&
    changes.some((x) => x.resource === 'elementor')
      ? ['Elementor is not active on the target site.']
      : []),
    ...changes.filter((x) => !x.safe).map((x) => x.reason),
  ];
  return {
    schemaVersion: '1.0',
    createdAt: new Date().toISOString(),
    snapshotCapturedAt: input.snapshot.capturedAt,
    changes,
    statistics,
    estimatedSeconds: Math.max(
      5,
      changes.reduce(
        (n, x) =>
          n + (x.action === 'unchanged' ? 0 : x.resource === 'media' ? 8 : 3),
        0,
      ),
    ),
    warnings,
    safetyStatus: changes.some((x) => !x.safe)
      ? 'blocked'
      : warnings.length
        ? 'warning'
        : 'safe',
    readOnly: true,
  };
}
