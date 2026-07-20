import type { BreakpointName, ResponsiveValue } from '../tokens/index.js';
import type { ContainerWidth } from './container.js';

export type SectionAlignment = 'start' | 'center' | 'end';
export type SupportedMedia =
  | 'none'
  | 'image'
  | 'video'
  | 'illustration'
  | 'icon'
  | 'avatar'
  | 'logo';
export type SectionBackground =
  | 'default'
  | 'surface'
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'media';
export interface ContentLimits {
  readonly maxHeadingCharacters: number;
  readonly maxBodyCharacters: number;
  readonly maxItems: number;
  readonly maxCallsToAction: number;
}
export interface ResponsiveBehavior {
  readonly stackAt?: BreakpointName;
  readonly columns: ResponsiveValue<number>;
  readonly mediaPosition: ResponsiveValue<
    'before' | 'after' | 'background' | 'hidden'
  >;
  readonly alignment: ResponsiveValue<SectionAlignment>;
}
export interface SectionStyleOptions<TStyle extends string = string> {
  readonly choices: readonly TStyle[];
  readonly backgrounds: readonly SectionBackground[];
  readonly defaultChoice: TStyle;
}
export interface SectionVariantDefinition<
  TKind extends string = string,
  TLayout extends string = string,
  TStyle extends string = string,
  TLimits extends ContentLimits = ContentLimits,
> {
  readonly kind: TKind;
  readonly layouts: readonly TLayout[];
  readonly defaultLayout: TLayout;
  readonly alignment: readonly SectionAlignment[];
  readonly contentLimits: TLimits;
  readonly supportedMedia: readonly SupportedMedia[];
  readonly responsive: ResponsiveBehavior;
  readonly styleOptions: SectionStyleOptions<TStyle>;
}
export interface SectionDefinition {
  readonly spacing: readonly ('compact' | 'default' | 'generous')[];
  readonly containers: readonly ContainerWidth[];
  readonly supportsAnchor: boolean;
  readonly supportsThemeOverride: boolean;
}
export const sectionDefinition: SectionDefinition = {
  spacing: ['compact', 'default', 'generous'],
  containers: ['narrow', 'standard', 'wide', 'full'],
  supportsAnchor: true,
  supportsThemeOverride: true,
};
