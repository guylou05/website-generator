import type { ColorTokenOverrides, DesignTokens } from '../tokens/index.js';
import { createDesignTokens } from '../tokens/index.js';
import type { SectionVariantKind } from '../variants/index.js';

export interface DesignSystemPreset {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly tokens: DesignTokens;
  readonly defaultSectionVariants: Readonly<Record<SectionVariantKind, string>>;
  readonly principles: readonly string[];
}

const webcareLeaderColorOverrides: ColorTokenOverrides = {
  light: {
    primary: '#155EEF',
    secondary: '#0E7490',
    accent: '#14B8A6',
    background: '#FFFFFF',
    text: '#0F172A',
    border: '#DCE5EE',
  },
  dark: {
    primary: '#6EA8FE',
    secondary: '#22D3EE',
    accent: '#5EEAD4',
    background: '#07111F',
    text: '#F8FAFC',
    border: '#26364A',
  },
};

export function createWebcareLeaderTheme(
  colors: ColorTokenOverrides = {},
): DesignSystemPreset {
  return {
    id: 'webcare-leader',
    name: 'WebcareLeader',
    description:
      'A clean, modern SaaS theme with a professional blue and teal palette.',
    tokens: createDesignTokens({
      colors: {
        light: { ...webcareLeaderColorOverrides.light, ...colors.light },
        dark: { ...webcareLeaderColorOverrides.dark, ...colors.dark },
      },
      typography: {
        fontFamily: {
          body: 'Inter, system-ui, sans-serif',
          heading: 'Inter, system-ui, sans-serif',
          mono: 'ui-monospace, monospace',
        },
      },
      spacing: {
        section: { base: '4.5rem', md: '7rem', lg: '9rem' },
        sectionCompact: { base: '3rem', md: '4.5rem', lg: '6rem' },
      },
      radius: { medium: '0.75rem', large: '1.25rem', xl: '1.75rem' },
      shadows: {
        subtle: '0 1px 3px rgb(15 23 42 / 0.06)',
        card: '0 10px 30px rgb(15 23 42 / 0.07)',
      },
    }),
    defaultSectionVariants: {
      header: 'bordered',
      hero: 'clean',
      services: 'cards',
      features: 'icon-cards',
      pricing: 'bordered',
      testimonials: 'cards',
      faq: 'divided',
      contact: 'card',
      cta: 'soft',
      footer: 'bordered',
    },
    principles: [
      'Clean modern SaaS presentation',
      'Generous responsive whitespace',
      'Rounded cards',
      'Subtle borders and shadows',
      'Professional blue and teal color system',
    ],
  };
}

export const webcareLeaderTheme = createWebcareLeaderTheme();
