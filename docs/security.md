# Security

Browser authentication uses Laravel Sanctum session cookies, CSRF validation, session regeneration at login, hashed passwords and password-reset tokens, signed email verification URLs, and narrowly configured credentialed CORS. Production must set `SESSION_SECURE_COOKIE=true`, exact `SANCTUM_STATEFUL_DOMAINS`, `CORS_ALLOWED_ORIGINS`, a strong `APP_KEY`, and a separately rotated `INTERNAL_WORKER_TOKEN`.

Invitation plaintext tokens are returned only in the newly generated URL and emailed; only SHA-256 hashes are stored. Audit metadata is allowlisted/scrubbed and must never contain credentials, invitation tokens, API keys, or WordPress application passwords. Cross-tenant route binding returns 404 and all created workload records inherit the server-side current organization.
