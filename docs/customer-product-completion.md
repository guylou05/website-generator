# Customer product completion

This document is the customer-facing release contract. All dashboard data comes from the authenticated organization; failed requests produce an error or empty state, never substitute demo records.

## Route and API matrix

| Route                                        | Purpose                                     | API                                                 | Authentication                | Role                       | Status / limitation                                                  |
| -------------------------------------------- | ------------------------------------------- | --------------------------------------------------- | ----------------------------- | -------------------------- | -------------------------------------------------------------------- |
| `/dashboard`                                 | Organization overview                       | `GET /dashboard/overview`                           | Sanctum                       | member+                    | Complete; operational health is heartbeat-derived                    |
| `/dashboard/new`                             | Seven-step project wizard                   | `POST /projects`, `POST /projects/{id}/generations` | Sanctum, verified to generate | member+ within entitlement | Complete; draft is browser-local until submission                    |
| `/dashboard/projects/{id}/generations/{run}` | Durable generation progress                 | `GET /generations/{run}`, retry/cancel endpoints    | Sanctum                       | member+                    | Complete; polling is used rather than push events                    |
| `/dashboard/projects`                        | Organization projects                       | `GET /projects`                                     | Sanctum                       | viewer+                    | Complete; current API returns the organization collection            |
| `/dashboard/projects/{id}`                   | Project history and actions                 | Project, revision, deployment, connection APIs      | Sanctum                       | viewer+; mutations member+ | Complete within API capabilities                                     |
| `/dashboard/projects/{id}/editor`            | Revision editing and preview                | Revision and preview-session APIs                   | Sanctum                       | member+                    | Supported blueprint controls only; approved revisions must be cloned |
| `/dashboard/projects/{id}/deploy`            | WordPress preview/deploy                    | Connection and deployment APIs                      | Sanctum, verified             | member+ and entitled       | Complete; preview pins revision/media state                          |
| `/dashboard/media`                           | Media management                            | `/media` upload and asset endpoints                 | Sanctum                       | member+                    | Complete; URLs are signed by storage                                 |
| `/dashboard/templates`                       | Configured starter catalog                  | versioned application configuration                 | Sanctum                       | viewer+                    | Static catalog; no synthetic ratings or usage claims                 |
| `/dashboard/settings`                        | Profile, organization, members and security | Profile, organization, invitation, session APIs     | Sanctum                       | varies by panel            | Complete; controls are hidden or explained by capability             |
| `/dashboard/settings/billing`                | Subscription and usage                      | `/billing/*`                                        | Sanctum, verified             | owner/admin                | Complete when Stripe is configured                                   |

## Roles

Owners manage billing, ownership and all members. Administrators manage organization settings and non-owner members. Members create and edit customer content within entitlements. Viewers receive read-only access. Server policies are authoritative; the dashboard also avoids presenting unauthorized mutations.

## Feature matrix and intentional limitations

Generation, revisions, media processing, AI images, WordPress diagnostics, deployment, billing, organizations, invitations, notification preferences and security settings use persisted APIs. The template catalog is deploy-time configuration, not a marketplace. Generation progress reconnects by polling persisted events. Active-session controls depend on a database-backed session driver. AI images require the already-configured provider; WordPress actions require the connector and a verified Application Password, which is write-only and never returned.

No visitor analytics, super-admin behavior, impersonation, marketplace, mobile client, or additional billing model is included.

## Staging checklist

1. Register, verify email, sign in, and confirm an empty organization dashboard.
2. Complete all seven wizard steps, refresh midway to confirm recovery, and submit once.
3. Observe persisted generation events, refresh, then exercise cancel/retry and success redirect.
4. Edit, validate, render, clone and approve a revision; confirm approved revisions are immutable.
5. Upload and process media; edit accessible metadata and place a stable asset reference.
6. Add and verify a disposable WordPress connection; download diagnostics.
7. Preview, confirm and run a deployment; verify pinned inputs and deployed URLs.
8. Exercise member roles, organization switching, notification preferences, password and session controls.
9. Verify plan usage, Stripe Checkout/Portal, error states, keyboard focus, and narrow layouts.

## External configuration

Production requires queue workers and scheduler heartbeats, Redis, object storage with signed URLs, a mail transport, Stripe keys/webhook secret and price mapping, OpenAI credentials when that provider is selected, and a reachable WordPress site with the matching connector version. CI and local smoke tests must use mocked provider/WordPress/Stripe transports and must never contact customer services.
