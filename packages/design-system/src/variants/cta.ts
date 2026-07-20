import type { SectionVariantDefinition } from '../components/index.js';
export type CtaLayout = 'centered' | 'split' | 'banner';
export type CtaStyle = 'solid' | 'soft' | 'bordered';
export const ctaVariants: SectionVariantDefinition<'cta', CtaLayout, CtaStyle> =
  {
    kind: 'cta',
    layouts: ['centered', 'split', 'banner'],
    defaultLayout: 'centered',
    alignment: ['start', 'center'],
    contentLimits: {
      maxHeadingCharacters: 80,
      maxBodyCharacters: 180,
      maxItems: 0,
      maxCallsToAction: 2,
    },
    supportedMedia: ['none', 'image', 'illustration'],
    responsive: {
      stackAt: 'sm',
      columns: { base: 1, md: 2 },
      mediaPosition: 'after',
      alignment: { base: 'center', md: 'start' },
    },
    styleOptions: {
      choices: ['solid', 'soft', 'bordered'],
      backgrounds: ['surface', 'primary', 'secondary', 'accent'],
      defaultChoice: 'solid',
    },
  };
