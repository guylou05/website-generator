export const breakpointNames = ['sm', 'md', 'lg', 'xl', '2xl'] as const;
export type BreakpointName = (typeof breakpointNames)[number];
export type ResponsiveValue<T> =
  | T
  | ({ readonly base: T } & Partial<Readonly<Record<BreakpointName, T>>>);
export interface BreakpointTokens {
  readonly sm: number;
  readonly md: number;
  readonly lg: number;
  readonly xl: number;
  readonly '2xl': number;
}
export const defaultBreakpoints: BreakpointTokens = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
};
