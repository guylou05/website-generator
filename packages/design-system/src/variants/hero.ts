import type {
  ContentLimits,
  SectionVariantDefinition,
} from '../components/index.js';
export interface HeroContentLimits extends ContentLimits {
  readonly maxEyebrowCharacters: number;
}
export type HeroLayout = 'centered' | 'split' | 'media-background';
export type HeroStyle = 'clean' | 'gradient' | 'framed';
export const heroVariants: SectionVariantDefinition<
  'hero',
  HeroLayout,
  HeroStyle,
  HeroContentLimits
> = {
  kind: 'hero',
  layouts: ['centered', 'split', 'media-background'],
  defaultLayout: 'split',
  alignment: ['start', 'center'],
  contentLimits: {
    maxHeadingCharacters: 80,
    maxBodyCharacters: 240,
    maxItems: 0,
    maxCallsToAction: 2,
    maxEyebrowCharacters: 40,
  },
  supportedMedia: ['none', 'image', 'video', 'illustration'],
  responsive: {
    stackAt: 'md',
    columns: { base: 1, md: 2 },
    mediaPosition: { base: 'after', md: 'after' },
    alignment: { base: 'center', md: 'start' },
  },
  styleOptions: {
    choices: ['clean', 'gradient', 'framed'],
    backgrounds: ['default', 'surface', 'primary', 'media'],
    defaultChoice: 'clean',
  },
};
