# API authentication and organizations

Initialize `GET /sanctum/csrf-cookie`, then send `X-XSRF-TOKEN` and credentials on modifying requests. Auth endpoints live at `/api/auth/{register,login,logout,user,forgot-password,reset-password,email/verification-notification}` with signed verification at `/api/auth/verify-email/{id}/{hash}`.

Authenticated organization CRUD is under `/api/organizations`; `/switch`, `/members`, `/transfer-ownership`, and `/invitations` subresources manage tenant context. Invitation acceptance is `POST /api/invitations/{token}/accept`. Existing project, generation, WordPress connection, and deployment APIs require Sanctum and are scoped to the active organization. `/api/internal/*` accepts only the internal worker token.
