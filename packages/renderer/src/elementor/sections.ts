import type {
  Footer,
  Navigation,
  Section,
} from '@website-generator/shared/schema';
import type { ElementorIdFactory } from './ids.js';
import {
  cardStyleSettings,
  sectionStyleSettings,
  type ElementorStyleContext,
} from './styles.js';
import type {
  ElementorContainer,
  ElementorElement,
  ElementorSectionKind,
} from './types.js';
import { UnsupportedElementorSectionError } from './types.js';
import {
  accordionWidget,
  buttonWidget,
  componentWidget,
  headingWidget,
  iconBoxWidget,
  textEditorWidget,
} from './widgets.js';

function container(
  ids: ElementorIdFactory,
  scope: string,
  settings: Record<string, unknown>,
  elements: readonly ElementorElement[],
  isInner = true,
): ElementorContainer {
  return {
    id: ids.id(scope),
    elType: 'container',
    isInner,
    settings,
    elements,
  };
}

export function identifySection(section: Section): ElementorSectionKind {
  if (section.type !== 'custom') {
    if (section.type === 'services') return 'services';
    if (
      ['hero', 'features', 'testimonials', 'cta', 'contact'].includes(
        section.type,
      )
    )
      return section.type as ElementorSectionKind;
  }
  const value = `${section.id} ${section.label ?? ''}`.toLowerCase();
  if (value.includes('header')) return 'header';
  if (value.includes('footer')) return 'footer';
  if (value.includes('trust')) return 'trust-bar';
  if (value.includes('pricing') || value.includes('plan')) return 'pricing';
  if (value.includes('faq') || value.includes('question')) return 'faq';
  throw new UnsupportedElementorSectionError(section.id, section.type);
}

export function renderSection(
  section: Section,
  ids: ElementorIdFactory,
  context: ElementorStyleContext,
): ElementorContainer {
  const kind = identifySection(section);
  const scope = `section.${section.id}`;
  const baseSettings = {
    ...sectionStyleSettings(
      context,
      section.layout.background,
      section.layout.columns,
    ),
    website_generator_section: kind,
    website_generator_source_id: section.id,
  };
  if (kind === 'faq')
    return container(
      ids,
      scope,
      baseSettings,
      renderFaq(section, ids, scope, context),
      false,
    );
  if (
    kind === 'services' ||
    kind === 'features' ||
    kind === 'pricing' ||
    kind === 'testimonials' ||
    kind === 'trust-bar'
  )
    return container(
      ids,
      scope,
      baseSettings,
      renderCardSection(section, kind, ids, scope, context),
      false,
    );
  return container(
    ids,
    scope,
    baseSettings,
    section.components.map((component) =>
      componentWidget(component, ids, scope, context),
    ),
    false,
  );
}

function renderCardSection(
  section: Section,
  kind: ElementorSectionKind,
  ids: ElementorIdFactory,
  scope: string,
  context: ElementorStyleContext,
): readonly ElementorElement[] {
  const [first, ...rest] = section.components;
  const elements: ElementorElement[] = [];
  if (first) elements.push(componentWidget(first, ids, scope, context));
  for (const [index, component] of rest.entries()) {
    if (component.type === 'text') {
      const title =
        kind === 'testimonials'
          ? `Client story ${index + 1}`
          : kind === 'trust-bar'
            ? 'Trusted capability'
            : `${section.label ?? kind} ${index + 1}`;
      elements.push(
        container(ids, `${scope}.card.${index}`, cardStyleSettings(context), [
          iconBoxWidget(
            ids,
            `${scope}.card.${index}.icon-box`,
            title,
            component.text,
            context,
            kind === 'testimonials'
              ? 'fas fa-quote-left'
              : 'fas fa-check-circle',
          ),
        ]),
      );
    } else
      elements.push(
        container(ids, `${scope}.card.${index}`, cardStyleSettings(context), [
          componentWidget(component, ids, `${scope}.card.${index}`, context),
        ]),
      );
  }
  return elements;
}

function renderFaq(
  section: Section,
  ids: ElementorIdFactory,
  scope: string,
  context: ElementorStyleContext,
): readonly ElementorElement[] {
  const elements: ElementorElement[] = [];
  const items: { title: string; content: string }[] = [];
  for (let index = 0; index < section.components.length; index += 1) {
    const component = section.components[index];
    const answer = section.components[index + 1];
    if (component?.type === 'heading' && component.level <= 2)
      elements.push(componentWidget(component, ids, scope, context));
    else if (component?.type === 'heading' && answer?.type === 'text') {
      items.push({ title: component.text, content: answer.text });
      index += 1;
    } else if (component)
      elements.push(componentWidget(component, ids, scope, context));
  }
  if (items.length)
    elements.push(accordionWidget(ids, `${scope}.accordion`, items, context));
  return elements;
}

export function renderHeader(
  navigation: Navigation,
  brandName: string,
  ids: ElementorIdFactory,
  context: ElementorStyleContext,
): ElementorContainer {
  const scope = 'site.header';
  const elements: ElementorElement[] = [
    headingWidget(ids, `${scope}.brand`, brandName, 3, context),
  ];
  for (const item of navigation.items)
    elements.push(
      buttonWidget(
        ids,
        `${scope}.nav.${item.id}`,
        item.label,
        item.href,
        'link',
        item.external ?? false,
        context,
      ),
    );
  if (navigation.cta)
    elements.push(
      buttonWidget(
        ids,
        `${scope}.cta`,
        navigation.cta.label,
        navigation.cta.href,
        'primary',
        navigation.cta.external,
        context,
      ),
    );
  return container(
    ids,
    scope,
    {
      ...sectionStyleSettings(context, 'default', navigation.items.length + 2),
      website_generator_section: 'header',
      flex_direction: 'row',
      flex_direction_tablet: 'column',
      flex_direction_mobile: 'column',
      padding: {
        unit: 'px',
        top: '20',
        right: '32',
        bottom: '20',
        left: '32',
        isLinked: false,
      },
    },
    elements,
    false,
  );
}

export function renderFooter(
  footer: Footer,
  ids: ElementorIdFactory,
  context: ElementorStyleContext,
): ElementorContainer {
  const scope = 'site.footer';
  const elements: ElementorElement[] = [];
  if (footer.tagline)
    elements.push(
      textEditorWidget(ids, `${scope}.tagline`, footer.tagline, context),
    );
  for (const [columnIndex, column] of footer.columns.entries()) {
    const children: ElementorElement[] = [
      headingWidget(
        ids,
        `${scope}.column.${columnIndex}.title`,
        column.title,
        3,
        context,
      ),
    ];
    for (const link of column.links)
      children.push(
        buttonWidget(
          ids,
          `${scope}.link.${link.id}`,
          link.label,
          link.href,
          'link',
          link.external ?? false,
          context,
        ),
      );
    elements.push(
      container(ids, `${scope}.column.${columnIndex}`, {}, children),
    );
  }
  for (const component of footer.components)
    elements.push(componentWidget(component, ids, scope, context));
  elements.push(
    textEditorWidget(ids, `${scope}.copyright`, footer.copyright, context),
  );
  return container(
    ids,
    scope,
    {
      ...sectionStyleSettings(
        context,
        'surface',
        Math.max(1, footer.columns.length),
      ),
      website_generator_section: 'footer',
    },
    elements,
    false,
  );
}
