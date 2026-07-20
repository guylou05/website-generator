export interface ShadowTokens {
  readonly none: string;
  readonly subtle: string;
  readonly card: string;
  readonly elevated: string;
  readonly focus: string;
}
export const defaultShadows: ShadowTokens = {
  none: 'none',
  subtle: '0 1px 2px rgb(15 23 42 / 0.05)',
  card: '0 8px 24px rgb(15 23 42 / 0.08)',
  elevated: '0 20px 50px rgb(15 23 42 / 0.14)',
  focus: '0 0 0 3px rgb(37 99 235 / 0.35)',
};
