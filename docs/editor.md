# Website editor and revisions

## Lifecycle

Generation creates the first normalized revision and promotes it to `ready` only when Blueprint validation and Elementor rendering succeed. Editing a ready or approved revision clones it. Drafts may be patched, validated, rendered, approved, superseded, archived, or used as the source of a rollback draft. Revision numbers increase per project and stable page, section, block, and field IDs survive content edits.

Approval is transactional: validation and rendered output are required, the former approval becomes `superseded`, and the project pins `approved_revision_id`. Deployment previews, live deploys, and retries use this exact revision; a live deployment requires a completed preview of the same revision and WordPress connection.

## Editing and conflicts

The editor supports content fields and constrained design tokens. It is intentionally not a free-form HTML, CSS, JavaScript, shortcode, or drag-and-drop builder. Every patch includes `expected_updated_at`; stale writes return HTTP 409 and the latest revision so users can reload or clone. Identical patches are no-ops. Local undo and redo are session-only.

## Preview security

Preview trees come from Blueprint data—not Elementor output—and use a strict component registry and content sanitization. Share links contain 64 random characters; only SHA-256 hashes are stored. Links expire after seven days, are revision-scoped, read-only, revocable, rate-limited, and return no-indexing headers.

## AI proposals

AI editing is asynchronous. A proposal records its target and expected source value, is validated by the worker's structured-output schema, and must be accepted or rejected. Acceptance rechecks optimistic concurrency, records a revision change, and preserves unrelated content. Usage keys distinguish field rewriting, section/page regeneration, and SEO improvement; idempotency keys prevent retry charges.

## Supported preview sections

Header, footer, hero, text, image-and-text, services, features, CTA, testimonials, FAQ, contact, business hours, logo strips, statistics, navigation, buttons, and non-submitting forms are supported. Unknown sections are safe placeholders in editor mode and block approval.
