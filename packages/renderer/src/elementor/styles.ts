import type { Branding, GlobalStyles } from '@website-generator/shared/schema';
import {
  createWebcareLeaderTheme,
  type DesignTokens,
} from '@website-generator/design-system';
import type { ElementorSettings } from './types.js';

export interface ElementorStyleContext {
  readonly tokens: DesignTokens;
  readonly branding: Branding;
  readonly globalStyles: GlobalStyles;
}

export function createElementorStyleContext(
  branding: Branding,
  globalStyles: GlobalStyles,
): ElementorStyleContext {
  const preset = createWebcareLeaderTheme({
    light: {
      primary: branding.colors.primary,
      secondary: branding.colors.secondary,
      accent: branding.colors.accent,
      background: branding.colors.background,
      text: branding.colors.text,
    },
  });
  return {
    tokens: {
      ...preset.tokens,
      typography: {
        ...preset.tokens.typography,
        fontFamily: {
          ...preset.tokens.typography.fontFamily,
          body: branding.typography.bodyFont,
          heading: branding.typography.headingFont,
        },
      },
    },
    branding,
    globalStyles,
  };
}

export function pageStyleSettings(
  context: ElementorStyleContext,
): ElementorSettings {
  const { colors, typography, spacing, radius, shadows, breakpoints } =
    context.tokens;
  return {
    custom_colors: Object.entries(colors.light).map(([title, color]) => ({
      _id: title,
      title,
      color,
    })),
    custom_typography: [
      {
        _id: 'heading',
        title: 'Heading',
        typography_font_family: typography.fontFamily.heading,
        typography_font_weight: '700',
      },
      {
        _id: 'body',
        title: 'Body',
        typography_font_family: typography.fontFamily.body,
        typography_font_weight: '400',
      },
    ],
    website_generator_tokens: {
      spacing,
      radius,
      shadows,
      breakpoints,
      dark_colors: colors.dark,
    },
  };
}

export function sectionStyleSettings(
  context: ElementorStyleContext,
  background: string,
  columns: number,
): ElementorSettings {
  const palette = context.tokens.colors.light;
  const backgroundColor =
    background === 'default'
      ? palette.background
      : (palette[background as keyof typeof palette] ?? palette.background);
  return {
    content_width: 'boxed',
    boxed_width: {
      unit: 'px',
      size:
        context.globalStyles.contentWidth === 'wide'
          ? 1440
          : context.globalStyles.contentWidth === 'narrow'
            ? 768
            : 1152,
    },
    flex_direction: columns > 1 ? 'row' : 'column',
    flex_direction_tablet: 'column',
    flex_direction_mobile: 'column',
    flex_wrap: 'wrap',
    gap: { unit: 'px', size: 32 },
    gap_tablet: { unit: 'px', size: 24 },
    gap_mobile: { unit: 'px', size: 16 },
    padding: {
      unit: 'px',
      top: '96',
      right: '32',
      bottom: '96',
      left: '32',
      isLinked: false,
    },
    padding_tablet: {
      unit: 'px',
      top: '72',
      right: '24',
      bottom: '72',
      left: '24',
      isLinked: false,
    },
    padding_mobile: {
      unit: 'px',
      top: '48',
      right: '16',
      bottom: '48',
      left: '16',
      isLinked: false,
    },
    background_background: 'classic',
    background_color: backgroundColor,
    border_border: 'solid',
    border_width: {
      unit: 'px',
      top: '1',
      right: '1',
      bottom: '1',
      left: '1',
      isLinked: true,
    },
    border_color: palette.border,
    border_radius: {
      unit: 'px',
      top: '0',
      right: '0',
      bottom: '0',
      left: '0',
      isLinked: true,
    },
    box_shadow_box_shadow_type: 'yes',
    box_shadow_box_shadow: context.tokens.shadows.subtle,
  };
}

export function cardStyleSettings(
  context: ElementorStyleContext,
): ElementorSettings {
  return {
    padding: {
      unit: 'px',
      top: '24',
      right: '24',
      bottom: '24',
      left: '24',
      isLinked: true,
    },
    background_background: 'classic',
    background_color: context.tokens.colors.light.surface,
    border_border: 'solid',
    border_width: {
      unit: 'px',
      top: '1',
      right: '1',
      bottom: '1',
      left: '1',
      isLinked: true,
    },
    border_color: context.tokens.colors.light.border,
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
  };
}
