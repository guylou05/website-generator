# Website Generator Connector

A minimal companion plugin that exposes authenticated deployment operations WordPress core does not expose safely through its standard REST API, including protected Elementor post metadata and classic navigation menus.

## Installation

1. Copy `website-generator-connector` into `wp-content/plugins/`, or create a ZIP containing this directory and upload it under **Plugins → Add New → Upload Plugin**.
2. Activate **Website Generator Connector**.
3. Ensure Elementor is active before using CSS regeneration.
4. Create an administrator Application Password as described in `packages/wordpress/README.md`.

All routes use the `website-generator/v1` namespace and accept authenticated REST requests only. Every route has a permission callback requiring `manage_options`; there are no anonymous write endpoints.

## Endpoints

| Method | Endpoint                    | Purpose                                                         |
| ------ | --------------------------- | --------------------------------------------------------------- |
| `POST` | `/pages/{id}/elementor`     | Save sanitized Elementor data and page settings                 |
| `POST` | `/pages/{id}/css`           | Invalidate page CSS metadata                                    |
| `POST` | `/elementor/regenerate-css` | Clear Elementor's generated-file cache                          |
| `POST` | `/pages/{id}/template`      | Set an allow-listed Elementor page template                     |
| `POST` | `/menus`                    | Idempotently create/update connector-managed classic menu items |
| `POST` | `/settings/homepage`        | Assign a valid page as the static homepage                      |

WordPress handles Application Password authentication before permission callbacks run. The plugin stores no credentials. Page IDs, templates, URLs, menu keys, titles, nested Elementor values, and homepage IDs are validated or sanitized before use.
