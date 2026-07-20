# WordPress Deployment Layer

Deploys validated Website Blueprints and rendered Elementor JSON to an existing WordPress installation through the REST API. Pages default to `draft`; the deployment package does not automatically publish content.

## WordPress prerequisites

1. Use HTTPS for the WordPress site.
2. Install and activate the companion plugin from `wordpress-plugin/website-generator-connector`.
3. Sign in as an administrator and open **Users → Profile**.
4. Under **Application Passwords**, enter a descriptive name such as `Website Generator`, then select **Add New Application Password**.
5. Copy the generated password immediately. WordPress only displays it once. Store it in a secret manager, not in source control or logs.
6. If the Application Passwords section is unavailable, confirm the site uses HTTPS and that no security plugin or host policy has disabled the feature.

Application Passwords are revocable credentials intended for API access. Use a dedicated administrator account where operational policy permits, restrict access to the deployment environment, and revoke the password when it is no longer needed.

## Usage

```ts
import {
  WordPressClient,
  WordPressDeployer,
} from '@website-generator/wordpress';

const client = new WordPressClient({
  url: process.env.WORDPRESS_URL!,
  username: process.env.WORDPRESS_USERNAME!,
  applicationPassword: process.env.WORDPRESS_APPLICATION_PASSWORD!,
});

await client.testConnection();
const result = await new WordPressDeployer(client).deploy({
  blueprint,
  elementorPages,
  dryRun: true,
});
```

Run a dry run first. It authenticates and reads existing page slugs so its report can distinguish creates from updates, but it sends no write requests. Set `dryRun: false` only after reviewing operations. Generated pages remain drafts unless an explicitly supported non-public status is selected.

## Idempotency

Pages are matched by normalized slug and updated when found. The homepage blueprint slug is stored as `home`, then assigned as WordPress's static front page. Connector-managed menu items carry stable blueprint keys; subsequent deployments update them and remove stale connector-managed items rather than duplicating them. Elementor metadata, CSS metadata, page templates, menus, and homepage settings are reapplied safely.

Create operations are not retried automatically because a timed-out POST could have succeeded remotely. Safe GET and PUT requests retry transient network, timeout, rate-limit, and server failures with bounded exponential backoff.

## Security

- Credentials are held privately by `WordPressClient` and are never included in logger context.
- Injected loggers receive only method, path, attempt, timing, and sanitized error details.
- The connector requires an authenticated user with `manage_options` capability for every route.
- Deploy through HTTPS and never commit `.env` files or Application Passwords.
- Review Elementor forms, integrations, links, and assets before publication.
