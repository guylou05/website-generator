import type {
  ContentLimits,
  SectionVariantDefinition,
} from '../components/index.js';
export interface FaqContentLimits extends ContentLimits {
  readonly maxAnswerCharacters: number;
}
export type FaqLayout = 'accordion' | 'two-column' | 'categorized';
export type FaqStyle = 'minimal' | 'divided' | 'cards';
export const faqVariants: SectionVariantDefinition<
  'faq',
  FaqLayout,
  FaqStyle,
  FaqContentLimits
> = {
  kind: 'faq',
  layouts: ['accordion', 'two-column', 'categorized'],
  defaultLayout: 'accordion',
  alignment: ['start', 'center'],
  contentLimits: {
    maxHeadingCharacters: 70,
    maxBodyCharacters: 160,
    maxItems: 16,
    maxCallsToAction: 1,
    maxAnswerCharacters: 500,
  },
  supportedMedia: ['none', 'icon'],
  responsive: {
    stackAt: 'md',
    columns: { base: 1, md: 2 },
    mediaPosition: 'hidden',
    alignment: 'start',
  },
  styleOptions: {
    choices: ['minimal', 'divided', 'cards'],
    backgrounds: ['default', 'surface'],
    defaultChoice: 'divided',
  },
};
