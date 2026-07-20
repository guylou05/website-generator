export type ContainerWidth = 'narrow' | 'standard' | 'wide' | 'full';
export interface ContainerDefinition {
  readonly widths: Readonly<Record<Exclude<ContainerWidth, 'full'>, string>>;
  readonly fullWidth: '100%';
  readonly defaultWidth: ContainerWidth;
  readonly usesResponsiveGutters: boolean;
}
export const containerDefinition: ContainerDefinition = {
  widths: { narrow: '48rem', standard: '72rem', wide: '90rem' },
  fullWidth: '100%',
  defaultWidth: 'standard',
  usesResponsiveGutters: true,
};
