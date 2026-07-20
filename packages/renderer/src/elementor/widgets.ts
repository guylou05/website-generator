import type {
  BlueprintComponent,
  FormField,
} from '@website-generator/shared/schema';
import type { ElementorIdFactory } from './ids.js';
import type { ElementorStyleContext } from './styles.js';
import type { ElementorWidget } from './types.js';
import { ElementorRenderError } from './types.js';

function widget(
  id: string,
  widgetType: ElementorWidget['widgetType'],
  settings: Record<string, unknown>,
): ElementorWidget {
  return { id, elType: 'widget', widgetType, settings, elements: [] };
}

export function headingWidget(
  ids: ElementorIdFactory,
  scope: string,
  text: string,
  level: number,
  context: ElementorStyleContext,
  align = 'start',
): ElementorWidget {
  return widget(ids.id(scope), 'heading', {
    title: text,
    header_size: `h${level}`,
    align,
    align_tablet: align,
    align_mobile: align === 'start' ? 'center' : align,
    title_color: context.tokens.colors.light.text,
    typography_typography: 'custom',
    typography_font_family: context.tokens.typography.fontFamily.heading,
    typography_font_weight: level <= 2 ? '700' : '600',
  });
}

export function textEditorWidget(
  ids: ElementorIdFactory,
  scope: string,
  text: string,
  context: ElementorStyleContext,
  align = 'start',
): ElementorWidget {
  return widget(ids.id(scope), 'text-editor', {
    editor: text,
    align,
    align_tablet: align,
    align_mobile: align === 'start' ? 'center' : align,
    text_color: context.tokens.colors.light.mutedText,
    typography_typography: 'custom',
    typography_font_family: context.tokens.typography.fontFamily.body,
    typography_font_size: { unit: 'px', size: 18 },
    typography_font_size_tablet: { unit: 'px', size: 17 },
    typography_font_size_mobile: { unit: 'px', size: 16 },
    typography_line_height: { unit: 'em', size: 1.7 },
  });
}

export function buttonWidget(
  ids: ElementorIdFactory,
  scope: string,
  label: string,
  href: string,
  intent: 'primary' | 'secondary' | 'link',
  external: boolean,
  context: ElementorStyleContext,
  align = 'start',
): ElementorWidget {
  const palette = context.tokens.colors.light;
  return widget(ids.id(scope), 'button', {
    text: label,
    link: { url: href, is_external: external, nofollow: false },
    align,
    align_tablet: align,
    align_mobile: 'center',
    button_type:
      intent === 'link'
        ? 'info'
        : intent === 'secondary'
          ? 'secondary'
          : 'primary',
    background_color:
      intent === 'secondary'
        ? palette.secondary
        : intent === 'link'
          ? 'transparent'
          : palette.primary,
    button_text_color: intent === 'link' ? palette.primary : '#FFFFFF',
    border_border: intent === 'link' ? '' : 'solid',
    border_color: intent === 'secondary' ? palette.secondary : palette.primary,
    border_radius: {
      unit: 'px',
      top: '10',
      right: '10',
      bottom: '10',
      left: '10',
      isLinked: true,
    },
    typography_typography: 'custom',
    typography_font_family: context.tokens.typography.fontFamily.body,
    typography_font_weight: '600',
  });
}

export function iconWidget(
  ids: ElementorIdFactory,
  scope: string,
  icon: string,
  context: ElementorStyleContext,
): ElementorWidget {
  return widget(ids.id(scope), 'icon', {
    selected_icon: { value: icon, library: 'fa-solid' },
    primary_color: context.tokens.colors.light.primary,
    size: { unit: 'px', size: 32 },
    size_tablet: { unit: 'px', size: 28 },
    size_mobile: { unit: 'px', size: 24 },
  });
}

export function imageWidget(
  ids: ElementorIdFactory,
  scope: string,
  url: string,
  alt: string,
  context: ElementorStyleContext,
): ElementorWidget {
  return widget(ids.id(scope), 'image', {
    image: { url, id: '' },
    image_alt: alt,
    image_size: 'full',
    width: { unit: '%', size: 100 },
    border_radius: {
      unit: 'px',
      top: '16',
      right: '16',
      bottom: '16',
      left: '16',
      isLinked: true,
    },
    box_shadow_box_shadow_type: 'yes',
    box_shadow_box_shadow: context.tokens.shadows.card,
  });
}

export function iconBoxWidget(
  ids: ElementorIdFactory,
  scope: string,
  title: string,
  description: string,
  context: ElementorStyleContext,
  icon = 'fas fa-check',
): ElementorWidget {
  return widget(ids.id(scope), 'icon-box', {
    selected_icon: { value: icon, library: 'fa-solid' },
    title_text: title,
    description_text: description,
    position: 'top',
    title_color: context.tokens.colors.light.text,
    description_color: context.tokens.colors.light.mutedText,
    primary_color: context.tokens.colors.light.primary,
    title_typography_typography: 'custom',
    title_typography_font_family: context.tokens.typography.fontFamily.heading,
    description_typography_typography: 'custom',
    description_typography_font_family:
      context.tokens.typography.fontFamily.body,
  });
}

export function accordionWidget(
  ids: ElementorIdFactory,
  scope: string,
  items: readonly { readonly title: string; readonly content: string }[],
  context: ElementorStyleContext,
): ElementorWidget {
  return widget(ids.id(scope), 'accordion', {
    tabs: items.map((item, index) => ({
      _id: ids.id(`${scope}.item.${index}`),
      tab_title: item.title,
      tab_content: item.content,
    })),
    selected_icon: { value: 'fas fa-plus', library: 'fa-solid' },
    selected_active_icon: { value: 'fas fa-minus', library: 'fa-solid' },
    title_color: context.tokens.colors.light.text,
    content_color: context.tokens.colors.light.mutedText,
    border_color: context.tokens.colors.light.border,
  });
}

export function formPlaceholderWidget(
  ids: ElementorIdFactory,
  scope: string,
  name: string,
  fields: readonly FormField[],
  submitLabel: string,
  successMessage: string,
  context: ElementorStyleContext,
): ElementorWidget {
  return widget(ids.id(scope), 'form', {
    form_name: name,
    form_fields: fields.map((field) => ({
      custom_id: field.id,
      field_label: field.label,
      field_type: field.type,
      required: field.required,
      placeholder: field.placeholder ?? '',
      field_options:
        field.options
          ?.map((option) => `${option.label}|${option.value}`)
          .join('\n') ?? '',
    })),
    button_text: submitLabel,
    success_message: successMessage,
    website_generator_placeholder: true,
    button_background_color: context.tokens.colors.light.primary,
    button_text_color: '#FFFFFF',
  });
}

export function componentWidget(
  component: BlueprintComponent,
  ids: ElementorIdFactory,
  scope: string,
  context: ElementorStyleContext,
): ElementorWidget {
  const componentScope = `${scope}.component.${component.id}`;
  const align = component.style?.align ?? 'start';
  switch (component.type) {
    case 'heading':
      return headingWidget(
        ids,
        componentScope,
        component.text,
        component.level,
        context,
        align,
      );
    case 'text':
      return textEditorWidget(
        ids,
        componentScope,
        component.text,
        context,
        align,
      );
    case 'button':
      return buttonWidget(
        ids,
        componentScope,
        component.label,
        component.href,
        component.intent,
        component.external,
        context,
        align,
      );
    case 'image':
      return imageWidget(
        ids,
        componentScope,
        component.url,
        component.alt,
        context,
      );
    case 'form':
      return formPlaceholderWidget(
        ids,
        componentScope,
        component.name,
        component.fields,
        component.submitLabel,
        component.successMessage,
        context,
      );
    default:
      throw new ElementorRenderError(
        'Unsupported blueprint component',
        componentScope,
      );
  }
}
