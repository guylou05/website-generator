# Dashboard implementation audit

Audited on 2026-08-01.

## Project data flow

- **Endpoint — fully implemented:** `GET /api/projects` and `GET /api/projects/{project}` are registered by Laravel's authenticated `apiResource`, inside both `auth:sanctum` and tenant-access middleware.
- **Frontend endpoint — fully implemented:** the dashboard client requests `/projects` and `/projects/{id}`. In proxy mode those become `/api/proxy/api/projects...`, and the proxy removes the duplicate `api` segment before forwarding upstream.
- **Authentication — fully implemented:** browser calls include credentials, Sanctum protects the API routes, and `AuthGuard` verifies the session. Project reads now run in the browser, where the authenticated session cookie is available. Previously, the Projects and Project Details server components made API requests without forwarding the browser cookie; the resulting 401 was displayed as the misleading API-connection message or converted into a Next.js 404.
- **Controller — fully implemented:** `ProjectController::index` returns the current organization's projects with the latest generation; `show` returns the selected project with generation events.
- **Serialization — fully implemented:** `ProjectResource` emits snake_case Laravel fields and the frontend's `mapProject` converts them to the camelCase `Project` interface, including nested generation runs.

## Navigation status

| Navigation item | Status              | Implementation                                                                                         |
| --------------- | ------------------- | ------------------------------------------------------------------------------------------------------ |
| Overview        | ✓ Fully implemented | Live organization metrics, recent projects, deployments, activity, usage, and system health.           |
| New Website     | ✓ Fully implemented | Multi-step website brief, project creation, and generation launch.                                     |
| Projects        | ✓ Fully implemented | Authenticated project listing with loading, empty, error/retry, and detail navigation states.          |
| Project Details | ✓ Fully implemented | Project summary, business profile, generation timeline/actions, and deployment history/actions.        |
| Templates       | ✓ Fully implemented | Template catalog with links that preselect a template in the website wizard.                           |
| Settings        | ✓ Fully implemented | Profile, organization, notification, billing, security, and appearance controls backed by API methods. |
| Notifications   | ✓ Fully implemented | Dedicated navigation route opens notification preferences in Settings.                                 |
| Billing         | ✓ Fully implemented | Dedicated plans, usage, Stripe checkout, and billing portal page.                                      |
| Security        | ✓ Fully implemented | Dedicated navigation route opens password and session management in Settings.                          |

No audited navigation destination is missing or a placeholder.
