export * from './breakpoints.js';
export * from './colors.js';
export * from './radius.js';
export * from './shadows.js';
export * from './spacing.js';
export * from './typography.js';

import type { BreakpointTokens } from './breakpoints.js';
import { defaultBreakpoints } from './breakpoints.js';
import type { ColorTokenOverrides, ColorTokens } from './colors.js';
import { createColorTokens } from './colors.js';
import type { RadiusTokens } from './radius.js';
import { defaultRadius } from './radius.js';
import type { ShadowTokens } from './shadows.js';
import { defaultShadows } from './shadows.js';
import type { SpacingTokens } from './spacing.js';
import { defaultSpacing } from './spacing.js';
import type { TypographyTokens } from './typography.js';
import { defaultTypography } from './typography.js';

export interface DesignTokens {
  readonly colors: ColorTokens;
  readonly typography: TypographyTokens;
  readonly spacing: SpacingTokens;
  readonly radius: RadiusTokens;
  readonly shadows: ShadowTokens;
  readonly breakpoints: BreakpointTokens;
}
export interface DesignTokenOverrides {
  readonly colors?: ColorTokenOverrides;
  readonly typography?: Partial<TypographyTokens>;
  readonly spacing?: Partial<SpacingTokens>;
  readonly radius?: Partial<RadiusTokens>;
  readonly shadows?: Partial<ShadowTokens>;
  readonly breakpoints?: Partial<BreakpointTokens>;
}
export function createDesignTokens(
  overrides: DesignTokenOverrides = {},
): DesignTokens {
  return {
    colors: createColorTokens(overrides.colors),
    typography: {
      ...defaultTypography,
      ...overrides.typography,
      fontFamily: {
        ...defaultTypography.fontFamily,
        ...overrides.typography?.fontFamily,
      },
    },
    spacing: {
      ...defaultSpacing,
      ...overrides.spacing,
      scale: { ...defaultSpacing.scale, ...overrides.spacing?.scale },
    },
    radius: { ...defaultRadius, ...overrides.radius },
    shadows: { ...defaultShadows, ...overrides.shadows },
    breakpoints: { ...defaultBreakpoints, ...overrides.breakpoints },
  };
}
export const defaultDesignTokens = createDesignTokens();
