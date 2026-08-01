import type { z } from 'zod';
import { siteBlueprintSchema, type SiteBlueprint } from './site.js';

export type SafeBlueprintIssue = Pick<
  z.ZodIssue,
  'code' | 'message' | 'path'
> & { expected?: string; received?: string };

const clone = (value: unknown): unknown =>
  value === undefined ? undefined : JSON.parse(JSON.stringify(value));

const nullableString = (value: unknown): unknown =>
  typeof value === 'string' ? value.trim() || null : value;

const nullableUrl = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  const candidate = value.trim();
  if (
    !candidate ||
    ['tbd', 'n/a', 'none', '#', 'about:blank'].includes(candidate.toLowerCase())
  )
    return null;
  try {
    const url = new URL(candidate);
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? candidate
      : null;
  } catch {
    return null;
  }
};

/** Convert an arbitrary page path or absolute URL to the canonical relative slug. */
export function slugifyPage(value: unknown): string {
  if (typeof value !== 'string') return '';
  let path = value.trim();
  try {
    const url = new URL(path);
    path = url.pathname;
  } catch {
    path = path.split(/[?#]/, 1)[0] ?? '';
  }
  return path
    .replace(/^\/+|\/+$/g, '')
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Trim copy to a limit, preferring a word boundary and clean punctuation. */
export function truncateSeo(value: unknown, maximum: number): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (trimmed.length <= maximum) return trimmed;
  const prefix = trimmed.slice(0, maximum + 1);
  const boundary = prefix.search(/\s+\S*$/);
  const result =
    boundary > 0 ? prefix.slice(0, boundary) : trimmed.slice(0, maximum);
  return result.trim().replace(/[\s,.;:!?\-–—]+$/g, '');
}

function normalizeDeterministicFields(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  type MutableObject = Record<string, unknown>;
  const object = (item: unknown): MutableObject | undefined =>
    item && typeof item === 'object' ? (item as MutableObject) : undefined;
  const objects = (item: unknown): MutableObject[] =>
    Array.isArray(item)
      ? item.flatMap((entry) => {
          const result = object(entry);
          return result ? [result] : [];
        })
      : [];
  const site = value as MutableObject;
  const seo = (candidate: unknown) => {
    const item = object(candidate);
    if (!item || typeof item !== 'object') return;
    item.title = truncateSeo(item.title, 70);
    item.description = truncateSeo(item.description, 320);
    item.canonicalUrl = nullableUrl(item.canonicalUrl);
    const openGraph = object(item.openGraph);
    if (openGraph) {
      for (const key of ['title', 'description', 'imageAlt'])
        openGraph[key] = nullableString(openGraph[key]);
      openGraph.imageUrl = nullableUrl(openGraph.imageUrl);
    }
  };
  seo(site.defaultSeo);
  const branding = object(site.branding);
  if (branding) {
    branding.tagline = nullableString(branding.tagline);
    for (const key of ['logo', 'mark']) {
      const asset = object(branding[key]);
      if (asset) {
        asset.url = nullableUrl(asset.url);
        if (asset.url === null) branding[key] = null;
      }
    }
  }
  const used = new Set<string>();
  for (const page of objects(site.pages)) {
    let slug = slugifyPage(page.slug);
    const base = slug;
    let suffix = 2;
    while (used.has(slug)) slug = `${base || 'page'}-${suffix++}`;
    used.add(slug);
    page.slug = slug;
    page.description = nullableString(page.description);
    seo(page.seo);
    for (const section of objects(page.sections)) {
      section.label = nullableString(section.label);
      for (const component of objects(section.components)) {
        component.accessibilityLabel = nullableString(
          component.accessibilityLabel,
        );
        const style = object(component.style);
        if (style) style.variant = nullableString(style.variant);
        if (component.type === 'image') {
          component.url = nullableUrl(component.url);
          component.caption = nullableString(component.caption);
        }
        if (component.type === 'form') {
          component.consentText = nullableString(component.consentText);
          for (const field of objects(component.fields))
            field.placeholder = nullableString(field.placeholder);
        }
      }
    }
  }
  const footer = object(site.footer);
  if (footer) footer.tagline = nullableString(footer.tagline);
}

/** Only removes fields explicitly rejected by the canonical strict schema. */
export function normalizeBlueprint(input: unknown): {
  value: unknown;
  applied: boolean;
} {
  const value = clone(input);
  let applied = false;
  const before = JSON.stringify(value);
  normalizeDeterministicFields(value);
  applied = JSON.stringify(value) !== before;
  for (let pass = 0; pass < 20; pass += 1) {
    const result = siteBlueprintSchema.safeParse(value);
    // Return the normalized wire value rather than Zod's transformed domain
    // value so explicit nulls remain available to repair prompts and logging.
    if (result.success) return { value, applied };
    const extras = result.error.issues.filter(
      (issue) => issue.code === 'unrecognized_keys',
    );
    if (!extras.length) break;
    for (const issue of extras) {
      let parent: unknown = value;
      for (const segment of issue.path)
        parent = (parent as Record<string | number, unknown>)?.[segment];
      if (parent && typeof parent === 'object')
        for (const key of issue.keys) {
          delete (parent as Record<string, unknown>)[key];
          applied = true;
        }
    }
  }
  return { value, applied };
}

export function safeBlueprintIssues(error: z.ZodError): SafeBlueprintIssue[] {
  return error.issues.map((issue) => {
    const typed = issue as z.ZodIssue & {
      expected?: string;
      received?: string;
    };
    return {
      path: issue.path,
      code: issue.code,
      message: issue.message,
      ...(typed.expected ? { expected: typed.expected } : {}),
      ...(typed.received ? { received: typed.received } : {}),
    };
  });
}

export const parseNormalizedBlueprint = (
  input: unknown,
): {
  blueprint: SiteBlueprint;
  normalized: boolean;
} => {
  const normalized = normalizeBlueprint(input);
  return {
    blueprint: siteBlueprintSchema.parse(normalized.value),
    normalized: normalized.applied,
  };
};
