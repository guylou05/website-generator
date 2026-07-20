# Website Generator Renderers

Builder-specific adapters consume the validated, builder-agnostic Website Blueprint. The first adapter targets Elementor's JSON template format and uses Flexbox Containers rather than legacy sections and columns.

## Elementor renderer

```ts
import { renderElementorPage } from '@website-generator/renderer/elementor';

const document = renderElementorPage(blueprint, 'page-home');
```

`renderElementorPage` validates unknown input with the shared Zod `siteBlueprintSchema` before rendering. It generates deterministic element IDs, applies the design-system theme plus blueprint brand overrides, emits responsive desktop/tablet/mobile settings, and throws `UnsupportedElementorSectionError` for a section it cannot safely translate.

The MVP supports Header, Hero, Trust Bar, Services, Features, Pricing, Testimonials, FAQ, CTA, Contact, and Footer sections. Heading, text editor, button, icon, image, icon box, accordion, and form-placeholder widget factories are exported for future section adapters. Form output requires a compatible Elementor form widget (commonly Elementor Pro) and is marked with `website_generator_placeholder` so an importer can review integrations and actions before publishing.

## Generate a page template

After installing dependencies and building workspace packages:

```bash
pnpm --filter @website-generator/design-system build
pnpm --filter @website-generator/shared build
pnpm --filter @website-generator/renderer build
```

Call `renderElementorPage`, then serialize the returned object with `JSON.stringify(document, null, 2)`. The committed demonstration is `templates/webcareleader/output/home.elementor.json`.

## Import into Elementor

1. Back up the WordPress site and test imports in a staging environment.
2. In WordPress, open **Templates → Saved Templates** and choose **Import Templates**.
3. Select the generated `.elementor.json` file and complete the import.
4. Create or open the destination page with Elementor, open the template library, choose **My Templates**, and insert the imported template.
5. Review global colors and fonts, image URLs, links, responsive breakpoints, and form actions before publishing.
6. Assign header or footer output through the site's theme/template builder when using those elements as global site chrome.

Elementor and installed add-ons may alter import screens or widget availability. The renderer emits no WordPress deployment operations and does not upload assets. Missing widgets, especially forms or icons, must be resolved in the target Elementor installation.

## Safety and compatibility

- Only parsed Website Blueprints should reach widget conversion.
- Blueprint content is treated as data; this package does not generate executable HTML.
- IDs are stable for the same blueprint paths and collision-checked within a document.
- Unknown sections fail descriptively instead of being silently dropped.
- Snapshot changes must be reviewed because they represent a builder-output contract change.
