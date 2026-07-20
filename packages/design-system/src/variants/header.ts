import type {
  ContentLimits,
  SectionVariantDefinition,
} from '../components/index.js';
export interface HeaderContentLimits extends ContentLimits {
  readonly maxNavigationItems: number;
  readonly maxUtilityItems: number;
}
export type HeaderLayout = 'logo-left' | 'logo-center' | 'split';
export type HeaderStyle = 'minimal' | 'bordered' | 'floating';
export const headerVariants: SectionVariantDefinition<
  'header',
  HeaderLayout,
  HeaderStyle,
  HeaderContentLimits
> = {
  kind: 'header',
  layouts: ['logo-left', 'logo-center', 'split'],
  defaultLayout: 'logo-left',
  alignment: ['start', 'center', 'end'],
  contentLimits: {
    maxHeadingCharacters: 60,
    maxBodyCharacters: 0,
    maxItems: 10,
    maxCallsToAction: 2,
    maxNavigationItems: 8,
    maxUtilityItems: 3,
  },
  supportedMedia: ['logo'],
  responsive: {
    stackAt: 'md',
    columns: 1,
    mediaPosition: 'before',
    alignment: { base: 'start', md: 'center' },
  },
  styleOptions: {
    choices: ['minimal', 'bordered', 'floating'],
    backgrounds: ['default', 'surface', 'primary'],
    defaultChoice: 'bordered',
  },
};
