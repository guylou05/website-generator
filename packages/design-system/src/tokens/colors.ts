export interface ThemePalette {
  readonly primary: string;
  readonly secondary: string;
  readonly accent: string;
  readonly background: string;
  readonly surface: string;
  readonly text: string;
  readonly mutedText: string;
  readonly border: string;
  readonly success: string;
  readonly warning: string;
  readonly danger: string;
}
export type BrandColorOverrides = Partial<
  Pick<
    ThemePalette,
    'primary' | 'secondary' | 'accent' | 'background' | 'text' | 'border'
  >
>;
export interface ColorTokenOverrides {
  readonly light?: BrandColorOverrides;
  readonly dark?: BrandColorOverrides;
}
export interface ColorTokens {
  readonly light: ThemePalette;
  readonly dark: ThemePalette;
}
export const defaultColors: ColorTokens = {
  light: {
    primary: '#1D4ED8',
    secondary: '#0F766E',
    accent: '#14B8A6',
    background: '#FFFFFF',
    surface: '#F8FAFC',
    text: '#0F172A',
    mutedText: '#475569',
    border: '#E2E8F0',
    success: '#15803D',
    warning: '#B45309',
    danger: '#B91C1C',
  },
  dark: {
    primary: '#60A5FA',
    secondary: '#2DD4BF',
    accent: '#5EEAD4',
    background: '#020617',
    surface: '#0F172A',
    text: '#F8FAFC',
    mutedText: '#94A3B8',
    border: '#334155',
    success: '#4ADE80',
    warning: '#FBBF24',
    danger: '#F87171',
  },
};
export function createColorTokens(
  overrides: ColorTokenOverrides = {},
): ColorTokens {
  return {
    light: { ...defaultColors.light, ...overrides.light },
    dark: { ...defaultColors.dark, ...overrides.dark },
  };
}
