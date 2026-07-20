import type { SiteBlueprint } from '@website-generator/shared/schema';
import { WordPressDeploymentError, WordPressError } from './errors.js';
import { WordPressElementor } from './elementor.js';
import { WordPressMenus } from './menus.js';
import { WordPressPages } from './pages.js';
import { WordPressSettings } from './settings.js';
import type {
  DeploymentInput,
  DeploymentOperation,
  DeploymentPageResult,
  DeploymentResult,
  ConnectorMenuItem,
  WordPressLogger,
} from './types.js';
import type { WordPressClient } from './client.js';

const noopLogger: WordPressLogger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};
export class WordPressDeployer {
  private readonly pages: WordPressPages;
  private readonly elementor: WordPressElementor;
  private readonly menus: WordPressMenus;
  private readonly settings: WordPressSettings;
  constructor(
    private readonly client: WordPressClient,
    private readonly logger: WordPressLogger = noopLogger,
  ) {
    this.pages = new WordPressPages(client);
    this.elementor = new WordPressElementor(client);
    this.menus = new WordPressMenus(client);
    this.settings = new WordPressSettings(client);
  }

  async deploy(input: DeploymentInput): Promise<DeploymentResult> {
    const dryRun = input.dryRun ?? false;
    const operations: DeploymentOperation[] = [];
    const pageResults: DeploymentPageResult[] = [];
    const pageIds = new Map<string, number>();
    await this.client.testConnection();
    this.logger.info('WordPress deployment started', {
      dryRun,
      pages: input.blueprint.pages.length,
    });
    try {
      for (const page of input.blueprint.pages) {
        const slug = wordpressSlug(page.slug, page.id);
        const document = input.elementorPages[page.id];
        if (!document)
          throw new WordPressDeploymentError(
            `Missing rendered Elementor JSON for blueprint page ${page.id}`,
            page.id,
          );
        const existing = await this.pages.findBySlug(slug);
        const action = existing ? 'update' : 'create';
        operations.push({
          action,
          resource: 'page',
          identifier: page.id,
          details: { slug, status: input.status ?? 'draft' },
        });
        operations.push({
          action: 'configure',
          resource: 'elementor',
          identifier: page.id,
          details: { template: 'elementor_canvas' },
        });
        if (dryRun) {
          pageResults.push({
            blueprintPageId: page.id,
            ...(existing ? { wordpressPageId: existing.id } : {}),
            slug,
            action,
          });
          continue;
        }
        const result = existing
          ? {
              page: await this.pages.update(existing.id, {
                title: page.title,
                slug,
                status: input.status ?? 'draft',
              }),
              action: 'update' as const,
            }
          : {
              page: await this.pages.create({
                title: page.title,
                slug,
                status: input.status ?? 'draft',
              }),
              action: 'create' as const,
            };
        pageIds.set(page.id, result.page.id);
        await this.elementor.savePageData(result.page.id, document);
        await this.elementor.setPageTemplate(result.page.id);
        await this.elementor.updateCssMetadata(result.page.id);
        pageResults.push({
          blueprintPageId: page.id,
          wordpressPageId: result.page.id,
          slug,
          action: result.action,
        });
      }
      operations.push({
        action: 'configure',
        resource: 'menu',
        identifier: input.menuName ?? 'Primary Navigation',
      });
      if (!dryRun)
        await this.menus.upsert(
          input.menuName ?? 'Primary Navigation',
          navigationItems(input.blueprint, pageIds),
        );
      const home = input.blueprint.pages.find((page) => page.slug === '');
      if ((input.setHomepage ?? true) && home) {
        operations.push({
          action: 'configure',
          resource: 'homepage',
          identifier: home.id,
        });
        if (!dryRun) {
          const homeId = pageIds.get(home.id);
          if (!homeId)
            throw new WordPressDeploymentError(
              'Homepage WordPress ID was not resolved',
              home.id,
            );
          await this.settings.setStaticHomepage(homeId);
        }
      }
      if (!dryRun) await this.elementor.regenerateCss();
      this.logger.info('WordPress deployment completed', {
        dryRun,
        pages: pageResults.length,
      });
      return { dryRun, pages: pageResults, operations };
    } catch (error) {
      this.logger.error('WordPress deployment failed', {
        dryRun,
        error: error instanceof Error ? error.message : String(error),
      });
      if (error instanceof WordPressError) throw error;
      throw new WordPressDeploymentError(
        'WordPress deployment failed',
        'deployment',
        { cause: error },
      );
    }
  }
}

function wordpressSlug(slug: string, pageId: string): string {
  return (
    slug.replace(/^\/+|\/+$/g, '') ||
    (pageId === 'page-home' ? 'home' : pageId.replace(/^page-/, ''))
  );
}
function navigationItems(
  blueprint: SiteBlueprint,
  pageIds: ReadonlyMap<string, number>,
): ConnectorMenuItem[] {
  const pageByHref = new Map(
    blueprint.pages.map((page) => [
      `/${page.slug}`.replace(/\/$/, '') || '/',
      page,
    ]),
  );
  const output: ConnectorMenuItem[] = [];
  const visit = (
    items: typeof blueprint.navigation.items,
    parentKey?: string,
  ) => {
    for (const item of items) {
      const page = pageByHref.get(item.href.replace(/\/$/, '') || '/');
      const pageId = page ? pageIds.get(page.id) : undefined;
      output.push({
        key: item.id,
        title: item.label,
        url: item.href,
        ...(pageId === undefined ? {} : { pageId }),
        ...(parentKey ? { parentKey } : {}),
      });
      if (item.children?.length) visit(item.children, item.id);
    }
  };
  visit(blueprint.navigation.items);
  return output;
}
