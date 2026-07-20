import type { ResponsiveValue } from './breakpoints.js';
export type FontWeight = 400 | 500 | 600 | 700;
export interface TypographyStyle {
  readonly fontSize: ResponsiveValue<string>;
  readonly lineHeight: ResponsiveValue<number>;
  readonly fontWeight: FontWeight;
  readonly letterSpacing?: string;
}
export interface TypographyTokens {
  readonly fontFamily: {
    readonly body: string;
    readonly heading: string;
    readonly mono: string;
  };
  readonly display: TypographyStyle;
  readonly h1: TypographyStyle;
  readonly h2: TypographyStyle;
  readonly h3: TypographyStyle;
  readonly body: TypographyStyle;
  readonly small: TypographyStyle;
  readonly label: TypographyStyle;
}
export const defaultTypography: TypographyTokens = {
  fontFamily: {
    body: 'Inter, system-ui, sans-serif',
    heading: 'Inter, system-ui, sans-serif',
    mono: 'ui-monospace, monospace',
  },
  display: {
    fontSize: { base: '2.5rem', md: '3.5rem', lg: '4.5rem' },
    lineHeight: { base: 1.1, lg: 1.05 },
    fontWeight: 700,
    letterSpacing: '-0.04em',
  },
  h1: {
    fontSize: { base: '2.25rem', md: '3rem', lg: '3.75rem' },
    lineHeight: 1.1,
    fontWeight: 700,
    letterSpacing: '-0.03em',
  },
  h2: {
    fontSize: { base: '1.875rem', md: '2.25rem', lg: '3rem' },
    lineHeight: 1.15,
    fontWeight: 700,
    letterSpacing: '-0.025em',
  },
  h3: {
    fontSize: { base: '1.25rem', md: '1.5rem' },
    lineHeight: 1.3,
    fontWeight: 600,
  },
  body: {
    fontSize: { base: '1rem', lg: '1.125rem' },
    lineHeight: 1.7,
    fontWeight: 400,
  },
  small: { fontSize: '0.875rem', lineHeight: 1.5, fontWeight: 400 },
  label: {
    fontSize: '0.875rem',
    lineHeight: 1.25,
    fontWeight: 600,
    letterSpacing: '0.02em',
  },
};
