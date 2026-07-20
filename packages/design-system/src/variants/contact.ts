import type {
  ContentLimits,
  SectionVariantDefinition,
} from '../components/index.js';
export interface ContactContentLimits extends ContentLimits {
  readonly maxFormFields: number;
  readonly maxContactMethods: number;
}
export type ContactLayout = 'form-centered' | 'form-split' | 'details-first';
export type ContactStyle = 'clean' | 'card' | 'contrast';
export const contactVariants: SectionVariantDefinition<
  'contact',
  ContactLayout,
  ContactStyle,
  ContactContentLimits
> = {
  kind: 'contact',
  layouts: ['form-centered', 'form-split', 'details-first'],
  defaultLayout: 'form-split',
  alignment: ['start', 'center'],
  contentLimits: {
    maxHeadingCharacters: 70,
    maxBodyCharacters: 240,
    maxItems: 6,
    maxCallsToAction: 1,
    maxFormFields: 10,
    maxContactMethods: 4,
  },
  supportedMedia: ['none', 'image', 'illustration', 'icon'],
  responsive: {
    stackAt: 'md',
    columns: { base: 1, md: 2 },
    mediaPosition: { base: 'after', md: 'before' },
    alignment: 'start',
  },
  styleOptions: {
    choices: ['clean', 'card', 'contrast'],
    backgrounds: ['default', 'surface', 'primary'],
    defaultChoice: 'card',
  },
};
