export * from './components/index.js';
export * from './presets/index.js';
export * from './tokens/index.js';
export * from './variants/index.js';

import type {
  ContactLayout,
  ContactStyle,
  CtaLayout,
  CtaStyle,
  FaqLayout,
  FaqStyle,
  FeaturesLayout,
  FeaturesStyle,
  FooterLayout,
  FooterStyle,
  HeaderLayout,
  HeaderStyle,
  HeroLayout,
  HeroStyle,
  PricingLayout,
  PricingStyle,
  ServicesLayout,
  ServicesStyle,
  TestimonialsLayout,
  TestimonialsStyle,
} from './variants/index.js';

export type SectionDesignSelection =
  | {
      readonly kind: 'header';
      readonly layout: HeaderLayout;
      readonly style: HeaderStyle;
    }
  | {
      readonly kind: 'hero';
      readonly layout: HeroLayout;
      readonly style: HeroStyle;
    }
  | {
      readonly kind: 'services';
      readonly layout: ServicesLayout;
      readonly style: ServicesStyle;
    }
  | {
      readonly kind: 'features';
      readonly layout: FeaturesLayout;
      readonly style: FeaturesStyle;
    }
  | {
      readonly kind: 'pricing';
      readonly layout: PricingLayout;
      readonly style: PricingStyle;
    }
  | {
      readonly kind: 'testimonials';
      readonly layout: TestimonialsLayout;
      readonly style: TestimonialsStyle;
    }
  | {
      readonly kind: 'faq';
      readonly layout: FaqLayout;
      readonly style: FaqStyle;
    }
  | {
      readonly kind: 'contact';
      readonly layout: ContactLayout;
      readonly style: ContactStyle;
    }
  | {
      readonly kind: 'cta';
      readonly layout: CtaLayout;
      readonly style: CtaStyle;
    }
  | {
      readonly kind: 'footer';
      readonly layout: FooterLayout;
      readonly style: FooterStyle;
    };

/** Portable reference stored alongside a Website Blueprint. */
export interface BlueprintDesignReference {
  readonly preset: string;
  readonly theme: 'light' | 'dark' | 'system';
  readonly sectionVariants: Readonly<Record<string, SectionDesignSelection>>;
}
