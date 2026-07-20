export type ButtonVariant =
  'primary' | 'secondary' | 'outline' | 'ghost' | 'link';
export type ButtonSize = 'small' | 'medium' | 'large';
export interface ButtonDefinition {
  readonly variants: readonly ButtonVariant[];
  readonly sizes: readonly ButtonSize[];
  readonly defaultVariant: ButtonVariant;
  readonly defaultSize: ButtonSize;
  readonly supportsIcon: boolean;
  readonly supportsFullWidth: boolean;
}
export const buttonDefinition: ButtonDefinition = {
  variants: ['primary', 'secondary', 'outline', 'ghost', 'link'],
  sizes: ['small', 'medium', 'large'],
  defaultVariant: 'primary',
  defaultSize: 'medium',
  supportsIcon: true,
  supportsFullWidth: true,
};
