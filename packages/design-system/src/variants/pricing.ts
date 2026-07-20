import type {
  ContentLimits,
  SectionVariantDefinition,
} from '../components/index.js';
export interface PricingContentLimits extends ContentLimits {
  readonly maxFeaturesPerPlan: number;
  readonly maxPlans: number;
}
export type PricingLayout = 'cards' | 'comparison' | 'single-featured';
export type PricingStyle = 'bordered' | 'elevated' | 'compact';
export const pricingVariants: SectionVariantDefinition<
  'pricing',
  PricingLayout,
  PricingStyle,
  PricingContentLimits
> = {
  kind: 'pricing',
  layouts: ['cards', 'comparison', 'single-featured'],
  defaultLayout: 'cards',
  alignment: ['start', 'center'],
  contentLimits: {
    maxHeadingCharacters: 70,
    maxBodyCharacters: 180,
    maxItems: 4,
    maxCallsToAction: 1,
    maxFeaturesPerPlan: 10,
    maxPlans: 4,
  },
  supportedMedia: ['none', 'icon'],
  responsive: {
    stackAt: 'md',
    columns: { base: 1, md: 2, lg: 3 },
    mediaPosition: 'before',
    alignment: 'center',
  },
  styleOptions: {
    choices: ['bordered', 'elevated', 'compact'],
    backgrounds: ['default', 'surface'],
    defaultChoice: 'bordered',
  },
};
