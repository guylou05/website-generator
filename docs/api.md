# API authentication and organizations

Initialize `GET /api/auth/csrf-token`, then send its `data.token` as `X-CSRF-TOKEN` with credentials on modifying requests. Returning the token in the response body supports dashboards hosted on a different origin, where JavaScript cannot read the API origin's `XSRF-TOKEN` cookie. Auth endpoints live at `/api/auth/{register,login,logout,user,forgot-password,reset-password,email/verification-notification}` with signed verification at `/api/auth/verify-email/{id}/{hash}`.

Authenticated organization CRUD is under `/api/organizations`; `/switch`, `/members`, `/transfer-ownership`, and `/invitations` subresources manage tenant context. Invitation acceptance is `POST /api/invitations/{token}/accept`. Existing project, generation, WordPress connection, and deployment APIs require Sanctum and are scoped to the active organization. `/api/internal/*` accepts only the internal worker token.

### Billing

Owner/admin endpoints: `GET /api/billing/plans`, `/summary`, `/usage`; `POST /api/billing/checkout-session`, `/portal-session`, `/change-plan`, `/cancel-subscription`, `/resume-subscription`. Limit denials use HTTP 402 with `code`, `metric`, `limit`, `used`, `remaining`, `current_plan`, and `upgrade_required`. Stripe sends signed events to unauthenticated `POST /api/webhooks/stripe`.

# Customer dashboard and settings

All endpoints below require the authenticated Sanctum session. Overview and organization resources use the authenticated user's current organization.

- `GET /api/dashboard/overview` — persisted metrics, recent projects/deployments/activity, account/organization context, and operational heartbeat state.
- `GET|PATCH /api/profile` — personal name, email, locale, timezone, appearance, and notifications. An email change requires `current_password` and clears verification.
- `POST|DELETE /api/profile/avatar` — attach an existing organization image media asset or remove it.
- `POST /api/profile/change-password` — requires `current_password`, `password`, and `password_confirmation`.
- `GET|DELETE /api/profile/sessions[/{session}]` and `POST /api/profile/sessions/revoke-others` — sanitized session management when database sessions are configured.
- `GET|PATCH /api/organization/settings` — organization metadata; only owners/admins may patch.
