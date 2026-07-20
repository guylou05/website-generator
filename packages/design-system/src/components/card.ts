export type CardVariant = 'plain' | 'bordered' | 'elevated' | 'interactive';
export interface CardDefinition {
  readonly variants: readonly CardVariant[];
  readonly defaultVariant: CardVariant;
  readonly mediaPositions: readonly ('top' | 'start' | 'background' | 'none')[];
  readonly supportsHeader: boolean;
  readonly supportsFooter: boolean;
}
export const cardDefinition: CardDefinition = {
  variants: ['plain', 'bordered', 'elevated', 'interactive'],
  defaultVariant: 'bordered',
  mediaPositions: ['top', 'start', 'background', 'none'],
  supportsHeader: true,
  supportsFooter: true,
};
