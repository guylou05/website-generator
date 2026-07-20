import type {
  ContentLimits,
  SectionVariantDefinition,
} from '../components/index.js';
export interface FooterContentLimits extends ContentLimits {
  readonly maxLinkColumns: number;
  readonly maxSocialLinks: number;
}
export type FooterLayout = 'columns' | 'compact' | 'centered';
export type FooterStyle = 'minimal' | 'bordered' | 'contrast';
export const footerVariants: SectionVariantDefinition<
  'footer',
  FooterLayout,
  FooterStyle,
  FooterContentLimits
> = {
  kind: 'footer',
  layouts: ['columns', 'compact', 'centered'],
  defaultLayout: 'columns',
  alignment: ['start', 'center'],
  contentLimits: {
    maxHeadingCharacters: 40,
    maxBodyCharacters: 180,
    maxItems: 30,
    maxCallsToAction: 1,
    maxLinkColumns: 6,
    maxSocialLinks: 8,
  },
  supportedMedia: ['none', 'logo', 'icon'],
  responsive: {
    stackAt: 'md',
    columns: { base: 1, md: 3, lg: 5 },
    mediaPosition: 'before',
    alignment: { base: 'center', md: 'start' },
  },
  styleOptions: {
    choices: ['minimal', 'bordered', 'contrast'],
    backgrounds: ['default', 'surface', 'primary'],
    defaultChoice: 'bordered',
  },
};
