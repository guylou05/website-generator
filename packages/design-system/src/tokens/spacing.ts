import type { ResponsiveValue } from './breakpoints.js';
export type SpacingStep =
  '0' | '1' | '2' | '3' | '4' | '6' | '8' | '12' | '16' | '20' | '24' | '32';
export type SpacingScale = Readonly<Record<SpacingStep, string>>;
export interface SpacingTokens {
  readonly scale: SpacingScale;
  readonly section: ResponsiveValue<string>;
  readonly sectionCompact: ResponsiveValue<string>;
  readonly containerGutter: ResponsiveValue<string>;
  readonly gridGap: ResponsiveValue<string>;
}
export const defaultSpacing: SpacingTokens = {
  scale: {
    '0': '0',
    '1': '0.25rem',
    '2': '0.5rem',
    '3': '0.75rem',
    '4': '1rem',
    '6': '1.5rem',
    '8': '2rem',
    '12': '3rem',
    '16': '4rem',
    '20': '5rem',
    '24': '6rem',
    '32': '8rem',
  },
  section: { base: '4rem', md: '6rem', lg: '8rem' },
  sectionCompact: { base: '3rem', md: '4rem', lg: '5rem' },
  containerGutter: { base: '1rem', md: '2rem', xl: '3rem' },
  gridGap: { base: '1rem', md: '1.5rem', lg: '2rem' },
};
