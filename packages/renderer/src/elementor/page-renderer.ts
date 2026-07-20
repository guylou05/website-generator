import {
  siteBlueprintSchema,
  type SiteBlueprint,
} from '@website-generator/shared/schema';
import { ElementorIdFactory } from './ids.js';
import {
  renderFooter,
  renderHeader,
  renderSection,
  identifySection,
} from './sections.js';
import { createElementorStyleContext, pageStyleSettings } from './styles.js';
import type { ElementorDocument } from './types.js';
import { ElementorRenderError } from './types.js';

export interface ElementorPageRenderOptions {
  readonly includeHeader?: boolean;
  readonly includeFooter?: boolean;
}

export function renderElementorPage(
  input: unknown,
  pageIdOrSlug: string,
  options: ElementorPageRenderOptions = {},
): ElementorDocument {
  const result = siteBlueprintSchema.safeParse(input);
  if (!result.success) {
    const issues = result.error.issues
      .map(
        (issue) => `${issue.path.join('.') || 'blueprint'}: ${issue.message}`,
      )
      .join('; ');
    throw new ElementorRenderError(
      `Website Blueprint validation failed: ${issues}`,
    );
  }
  return renderValidatedElementorPage(result.data, pageIdOrSlug, options);
}

/** Accepts a blueprint already validated by the caller; prefer renderElementorPage at boundaries. */
export function renderValidatedElementorPage(
  blueprint: SiteBlueprint,
  pageIdOrSlug: string,
  options: ElementorPageRenderOptions = {},
): ElementorDocument {
  const normalizedSlug = pageIdOrSlug.replace(/^\//, '').replace(/\/$/, '');
  const page = blueprint.pages.find(
    (candidate) =>
      candidate.id === pageIdOrSlug || candidate.slug === normalizedSlug,
  );
  if (!page)
    throw new ElementorRenderError(
      `Blueprint page "${pageIdOrSlug}" was not found`,
      'pages',
    );
  const ids = new ElementorIdFactory();
  const styles = createElementorStyleContext(
    blueprint.branding,
    blueprint.globalStyles,
  );
  const content = [];
  if (options.includeHeader ?? true)
    content.push(
      renderHeader(blueprint.navigation, blueprint.branding.name, ids, styles),
    );
  for (const section of page.sections)
    content.push(renderSection(section, ids, styles));
  const hasExplicitFooter = page.sections.some((section) => {
    try {
      return identifySection(section) === 'footer';
    } catch {
      return false;
    }
  });
  if ((options.includeFooter ?? true) && !hasExplicitFooter)
    content.push(renderFooter(blueprint.footer, ids, styles));
  return {
    version: '0.4',
    title: page.title,
    type: 'page',
    page_settings: {
      ...pageStyleSettings(styles),
      hide_title: 'yes',
      page_layout: 'elementor_canvas',
      website_generator: {
        renderer: 'elementor',
        schemaVersion: blueprint.schemaVersion,
        sourcePageId: page.id,
      },
    },
    content,
  };
}
