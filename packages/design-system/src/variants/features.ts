import type {
  ContentLimits,
  SectionVariantDefinition,
} from '../components/index.js';
export interface FeaturesContentLimits extends ContentLimits {
  readonly maxItemBodyCharacters: number;
}
export type FeaturesLayout = 'grid' | 'split' | 'alternating';
export type FeaturesStyle = 'minimal' | 'icon-cards' | 'showcase';
export const featuresVariants: SectionVariantDefinition<
  'features',
  FeaturesLayout,
  FeaturesStyle,
  FeaturesContentLimits
> = {
  kind: 'features',
  layouts: ['grid', 'split', 'alternating'],
  defaultLayout: 'grid',
  alignment: ['start', 'center'],
  contentLimits: {
    maxHeadingCharacters: 70,
    maxBodyCharacters: 220,
    maxItems: 12,
    maxCallsToAction: 1,
    maxItemBodyCharacters: 160,
  },
  supportedMedia: ['none', 'image', 'illustration', 'icon'],
  responsive: {
    stackAt: 'md',
    columns: { base: 1, md: 2, lg: 3 },
    mediaPosition: { base: 'after', md: 'before' },
    alignment: 'start',
  },
  styleOptions: {
    choices: ['minimal', 'icon-cards', 'showcase'],
    backgrounds: ['default', 'surface', 'secondary'],
    defaultChoice: 'icon-cards',
  },
};
