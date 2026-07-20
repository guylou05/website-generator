export * from './contact.js';
export * from './cta.js';
export * from './faq.js';
export * from './features.js';
export * from './footer.js';
export * from './header.js';
export * from './hero.js';
export * from './pricing.js';
export * from './services.js';
export * from './testimonials.js';

import { contactVariants } from './contact.js';
import { ctaVariants } from './cta.js';
import { faqVariants } from './faq.js';
import { featuresVariants } from './features.js';
import { footerVariants } from './footer.js';
import { headerVariants } from './header.js';
import { heroVariants } from './hero.js';
import { pricingVariants } from './pricing.js';
import { servicesVariants } from './services.js';
import { testimonialsVariants } from './testimonials.js';
export const sectionVariants = {
  header: headerVariants,
  hero: heroVariants,
  services: servicesVariants,
  features: featuresVariants,
  pricing: pricingVariants,
  testimonials: testimonialsVariants,
  faq: faqVariants,
  contact: contactVariants,
  cta: ctaVariants,
  footer: footerVariants,
} as const;
export type SectionVariantKind = keyof typeof sectionVariants;
