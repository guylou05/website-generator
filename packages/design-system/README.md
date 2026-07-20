# Website Generator Design System

A builder-agnostic TypeScript contract for translating a Website Blueprint into a consistent visual system. This package defines semantic values only: it contains no React components, HTML, CSS, Elementor data, or renderer behavior.

## What is included

- Light and dark semantic color palettes with non-mutating brand overrides.
- Responsive typography, spacing, gutters, and grid gaps.
- Radius, shadow, breakpoint, button, card, container, and section definitions.
- Typed Header, Hero, Services, Features, Pricing, Testimonials, FAQ, Contact, CTA, and Footer variants.
- The `WebcareLeader` preset: modern SaaS styling, generous whitespace, rounded cards, subtle borders and shadows, a professional blue/teal palette, and Inter typography.

## Selecting a theme

```ts
import { createWebcareLeaderTheme } from '@website-generator/design-system/presets';

const theme = createWebcareLeaderTheme({
  light: { primary: '#174EA6', accent: '#0F9D8A' },
  dark: { primary: '#8AB4F8', accent: '#5EEAD4' },
});
```

Overrides are restricted to semantic brand colors: `primary`, `secondary`, `accent`, `background`, `text`, and `border`. Other accessibility and status tokens retain preset defaults.

## Referencing it from a Website Blueprint

The blueprint remains builder-agnostic. Persist a `BlueprintDesignReference` beside it, keyed by stable blueprint section IDs:

```ts
import type { SiteBlueprint } from '@website-generator/shared/schema';
import type { BlueprintDesignReference } from '@website-generator/design-system';

const blueprint: SiteBlueprint = getBlueprint();
const design: BlueprintDesignReference = {
  preset: 'webcare-leader',
  theme: 'system',
  sectionVariants: {
    'home-hero': { kind: 'hero', layout: 'split', style: 'clean' },
    'home-services': { kind: 'services', layout: 'grid', style: 'cards' },
    'site-footer': { kind: 'footer', layout: 'columns', style: 'bordered' },
  },
};

saveWebsite({ blueprint, design });
```

The renderer resolves each reference against `sectionVariants`, validates content limits, and maps semantic tokens to its own output format. The blueprint does not contain CSS classes or builder-specific settings.

## Variant contract

Every section variant declares:

1. supported layouts and a default layout;
2. allowed content alignment;
3. explicit heading, body, item, and CTA limits;
4. supported media roles;
5. responsive column, media-position, stacking, and alignment behavior; and
6. semantic style choices and allowed background roles.

Consumers should reject unknown variant IDs rather than silently selecting arbitrary renderer behavior.

## Commands

```bash
pnpm --filter @website-generator/design-system typecheck
pnpm --filter @website-generator/design-system test
```
