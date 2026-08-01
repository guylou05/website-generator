# Customer dashboard completion

The customer dashboard uses the authenticated Sanctum session and the user's current organization. It never falls back to demonstration data after an API failure.

## Connected APIs

- `GET /api/dashboard/overview` returns organization-scoped projects, deployments, audit activity, persisted usage, and operational signals.
- `GET|PATCH /api/profile`, avatar attach/remove, password change, and session listing/revocation manage personal settings.
- `GET|PATCH /api/organization/settings` separates organization fields and enforces owner/admin edits.
- Existing billing summary, usage, checkout, and portal APIs remain the billing source.

Empty organizations show zero projects and websites, no generation duration, no deployments, no activity, and no health percentage. Visitor analytics are explicitly unavailable because the platform does not persist them.

## Settings capabilities

Profile names, email, timezone, locale, notification preferences, password, organization metadata, billing navigation, email verification, session revocation, and light/dark/system appearance are connected. Security notices remain enabled. Avatars reuse an existing ready image media asset; direct file selection in Settings is intentionally unsupported and clearly labelled. Session revocation reports unsupported when the configured session driver cannot enumerate sessions.

## Route and feature-completion matrix

| Route                             | State    | Connected behavior                                                                               |
| --------------------------------- | -------- | ------------------------------------------------------------------------------------------------ |
| `/dashboard`                      | Complete | Overview API, loading/error/empty states, real metrics and records                               |
| `/dashboard/new`                  | Complete | Empty wizard input creates a project and generation                                              |
| `/dashboard/projects`             | Complete | Organization-scoped project API                                                                  |
| `/dashboard/projects/{id}`        | Complete | Project, generation, revision and deployment data                                                |
| `/dashboard/projects/{id}/editor` | Partial  | Local editing controls; unsupported comparison/persistence controls must remain visibly labelled |
| `/dashboard/projects/{id}/deploy` | Complete | WordPress connection and deployment APIs                                                         |
| `/dashboard/templates`            | Complete | Clearly labelled static starter catalog; selection links into the wizard                         |
| `/dashboard/media`                | Complete | Existing organization media API                                                                  |
| `/dashboard/settings`             | Complete | Profile, organization, notifications, billing, security and appearance                           |
| `/dashboard/settings/billing`     | Complete | Existing plan, usage, portal and checkout APIs                                                   |
| Organization/member routes        | Complete | Existing role-protected membership APIs                                                          |

## Operational behavior

An expired session offers a sign-in action. Connectivity errors show a retry action and never substitute sample records. Field validation is rendered beside profile inputs. Worker and scheduler booleans are true only when their real cache heartbeat exists; otherwise the API reports false/unknown.
