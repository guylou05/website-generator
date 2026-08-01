# Production readiness

SiteFoundry is ready for **staging and controlled production testing**, not unattended general availability. Run `php artisan app:release-check` in the API container before every release; a non-zero result blocks promotion. `/api/health` is a cheap liveness probe and `/api/readiness` is a cached dependency summary. Never expose the authenticated environment diagnostic publicly.

## Release checklist

- [ ] Pin `VERSION`, image digests, approved revision, and media checksums.
- [ ] Back up PostgreSQL and confirm object-store versioning/retention.
- [ ] Run migrations in pre-deploy and confirm there are no pending migrations afterward.
- [ ] Run `mail:test`, `ai:diagnose`, `media:diagnose`, `billing:diagnose`, `jobs:diagnose`, `data:diagnose`, and `app:release-check`.
- [ ] Confirm worker and scheduler heartbeat, failed-job alerting, and retry policy.
- [ ] Run the automated suite and the customer journey in `smoke-testing.md`.
- [ ] Build and syntax-check the connector, deploy, then verify health/readiness and one mock generation.

## Rollback checklist

1. Stop new deployments and workers; preserve logs and diagnostic references.
2. Roll services back to the prior immutable image. Restore the database only when the migration is not backward compatible.
3. For WordPress, redeploy the previously approved revision and restore the captured homepage/navigation assignments. Never perform an arbitrary database rollback.
4. Re-enable workers, inspect failed jobs, and verify customer-facing URLs.

## Configuration diagnostics

SMTP providers (Resend, Mailgun, and Postmark included) use the standard `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, and `MAIL_SCHEME` variables. Log mail is development-only. AI diagnostics validate provider, model, timeout, and retry configuration without generation. Billing diagnostics validate test/live keys, known prices, and webhook secret without creating a charge. Storage diagnostics perform a disposable write/read/delete lifecycle.

Transactional security email has no unsubscribe link. Optional marketing mail must use a separate consent-aware mailing system. Logs and reports must contain identifiers and safe summaries, never credentials or raw provider payloads.

## Release notes template

**Version / date:**  
**Customer impact:**  
**Migrations:**  
**Configuration changes:**  
**Risk and rollback trigger:**  
**Verification results and owner:**
