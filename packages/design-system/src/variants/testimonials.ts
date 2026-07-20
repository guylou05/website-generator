import type {
  ContentLimits,
  SectionVariantDefinition,
} from '../components/index.js';
export interface TestimonialsContentLimits extends ContentLimits {
  readonly maxQuoteCharacters: number;
}
export type TestimonialsLayout = 'grid' | 'featured' | 'carousel';
export type TestimonialsStyle = 'cards' | 'quotes' | 'logo-led';
export const testimonialsVariants: SectionVariantDefinition<
  'testimonials',
  TestimonialsLayout,
  TestimonialsStyle,
  TestimonialsContentLimits
> = {
  kind: 'testimonials',
  layouts: ['grid', 'featured', 'carousel'],
  defaultLayout: 'grid',
  alignment: ['start', 'center'],
  contentLimits: {
    maxHeadingCharacters: 70,
    maxBodyCharacters: 160,
    maxItems: 9,
    maxCallsToAction: 1,
    maxQuoteCharacters: 360,
  },
  supportedMedia: ['none', 'avatar', 'logo'],
  responsive: {
    stackAt: 'sm',
    columns: { base: 1, md: 2, lg: 3 },
    mediaPosition: 'before',
    alignment: 'start',
  },
  styleOptions: {
    choices: ['cards', 'quotes', 'logo-led'],
    backgrounds: ['default', 'surface', 'primary'],
    defaultChoice: 'cards',
  },
};
