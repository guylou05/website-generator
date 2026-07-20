# WebcareLeader Template

A production-oriented, builder-agnostic Website Blueprint template for a fictional website care and technical support company. It contains no renderer output, HTML templates, or Elementor data.

## Structure

- `website.json` is the complete `SiteBlueprint` and source of truth.
- `pages/*.json` contains each page as a standalone `Page` schema object for focused editing.
- `sections/*.json` contains reusable `Section` schema objects. Consumers copy these definitions into pages and assign context-appropriate stable IDs and content.
- `content/content-guide.json` documents reusable voice and messaging.
- `assets/manifest.json` catalogs placeholder assets; the included SVG is a replaceable brand placeholder.

Because the current Website Blueprint schema embeds sections, reusable section files are authoring primitives rather than runtime references. `website.json` intentionally contains fully resolved sections so any future renderer can consume it without filesystem lookups.

## Validation

From the repository root, after installing workspace dependencies:

```bash
pnpm --filter @website-generator/shared build
node templates/webcareleader/validate.mjs
```

The validator parses `website.json`, every page, and every reusable section with the existing Zod schemas. It also verifies that standalone page files exactly match the pages embedded in `website.json`.
