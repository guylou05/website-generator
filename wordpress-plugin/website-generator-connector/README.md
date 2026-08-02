# Website Generator Connector

A minimal companion plugin that exposes authenticated deployment operations WordPress core does not expose safely through its standard REST API, including protected Elementor post metadata and classic navigation menus.

## Installation

1. Copy `website-generator-connector` into `wp-content/plugins/`, or create a ZIP containing this directory and upload it under **Plugins → Add New → Upload Plugin**.
2. Activate **Website Generator Connector**.
3. Ensure Elementor is installed and active.
4. In wp-admin, open **SiteFoundry** in the left sidebar.
5. Select **Generate token**, copy the token immediately, and store it in the corresponding site connection in SiteFoundry. The plaintext token is displayed only once.

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

The connector accepts an administrator WordPress session, an Application Password, or a generated connector Bearer token. Only a password hash of a connector token is retained. Page IDs, templates, URLs, menu keys, titles, nested Elementor values, and homepage IDs are validated or sanitized before use.

## Connection verification

Authenticated administrators can call `GET /wp-json/website-generator/v1/status` to inspect WordPress, connector, and Elementor availability and versions. All mutation endpoints require administrator capabilities and are designed for repeatable server-side deployments.

The **SiteFoundry** admin page shows environment and connection details. Use **Run connection health test** to check REST availability, connector route registration, Elementor installation and activation, and administrator capabilities. Regenerating a token immediately invalidates the previous token; **Revoke token** disconnects token-based clients.

## Connect to SiteFoundry

1. Open **SiteFoundry** in the WordPress admin sidebar.
2. Generate a connector token and use **Copy token** while it is visible.
3. In SiteFoundry, add or edit the WordPress site connection.
4. Copy the WordPress site URL and connector endpoint shown under **Connection Details**, then paste the token into the connector-token field.
5. Save the connection and run the connection test. Never place the token in a URL, log, support message, or source-control file.

## Requirements and secure credentials

Version 1.0.0 requires WordPress 6.5+, PHP 8.1+, and Elementor 3.20+ for Elementor deployment. Upload `sitefoundry-connector.zip`, activate it, and resolve any activation error before connecting.

In **Users → Profile → Application Passwords**, create a dedicated `SiteFoundry` password for an administrator over HTTPS. Copy it directly into SiteFoundry, verify the connection, and discard the displayed copy. Do not use the account password, send the credential by email, or place it in a URL. Revoking the Application Password disconnects SiteFoundry without changing the WordPress login.

Upgrades retain schema state and all customer pages/media. Uninstall also preserves customer content; connector settings are removed only when `SITEFOUNDRY_CONNECTOR_REMOVE_SETTINGS` is explicitly set to `true`.
