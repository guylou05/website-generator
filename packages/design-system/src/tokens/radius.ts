export interface RadiusTokens {
  readonly none: string;
  readonly small: string;
  readonly medium: string;
  readonly large: string;
  readonly xl: string;
  readonly pill: string;
}
export const defaultRadius: RadiusTokens = {
  none: '0',
  small: '0.375rem',
  medium: '0.625rem',
  large: '1rem',
  xl: '1.5rem',
  pill: '9999px',
};
