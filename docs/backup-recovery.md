# Backup and recovery

Enable Railway PostgreSQL backups (and take an export before migrations); enable bucket versioning/lifecycle retention for S3, R2, or B2. Quarterly, restore both into an isolated environment, run migrations, `media:rebuild-usage --dry-run`, `data:diagnose`, and the smoke checklist, then record RPO/RTO and checksums. Never claim a backup is valid until a restore is tested.

## Restore

1. Freeze writes and retain the incident timestamp. Restore PostgreSQL to a new database, validate counts/FKs, then switch `DATABASE_URL` during a maintenance window.
2. Restore versioned objects to the configured bucket/prefix; verify representative checksums and signed URLs. Run media usage rebuild first in dry-run mode, then explicitly execute after review.
3. Run `php artisan migrate --force` (migrations are repeatable), diagnostics, and smoke tests before reopening traffic.

## Rotation

Deploy old+new internal worker tokens during a bounded overlap, restart API/workers, then revoke old. For Stripe, create a webhook secret, update API, verify forwarding/signatures, then remove old endpoint. Replace OpenAI/S3 keys and restart workers. For WordPress, create a new Application Password, verify it, update the encrypted connection, then revoke the old password. Never print secrets in tickets or logs.

## Verification checklist

- [ ] Database restore opens and row/tenant counts match expectations.
- [ ] Media samples and variants match stored checksums.
- [ ] Migrations and integrity diagnostics pass.
- [ ] Key rotations were verified before old credentials were revoked.
- [ ] Health, readiness, generation, mail, deployment preview, and deployed URLs pass.
