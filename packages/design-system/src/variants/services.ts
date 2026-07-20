import type {
  ContentLimits,
  SectionVariantDefinition,
} from '../components/index.js';
export interface ServicesContentLimits extends ContentLimits {
  readonly maxCardBodyCharacters: number;
}
export type ServicesLayout = 'grid' | 'alternating' | 'list';
export type ServicesStyle = 'cards' | 'bordered' | 'icon-led';
export const servicesVariants: SectionVariantDefinition<
  'services',
  ServicesLayout,
  ServicesStyle,
  ServicesContentLimits
> = {
  kind: 'services',
  layouts: ['grid', 'alternating', 'list'],
  defaultLayout: 'grid',
  alignment: ['start', 'center'],
  contentLimits: {
    maxHeadingCharacters: 70,
    maxBodyCharacters: 220,
    maxItems: 12,
    maxCallsToAction: 1,
    maxCardBodyCharacters: 180,
  },
  supportedMedia: ['none', 'image', 'illustration', 'icon'],
  responsive: {
    stackAt: 'sm',
    columns: { base: 1, md: 2, lg: 3 },
    mediaPosition: 'before',
    alignment: 'start',
  },
  styleOptions: {
    choices: ['cards', 'bordered', 'icon-led'],
    backgrounds: ['default', 'surface'],
    defaultChoice: 'cards',
  },
};
