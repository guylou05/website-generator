# Deployment jobs

A successful generation and successful dry-run preview are required before live deployment. Only one active live deployment per project is allowed. Submit `POST /api/projects/{project}/deployments/preview`, observe the persisted result, and then submit `POST /api/projects/{project}/deployments`; both return 202.

The worker receives decrypted Application Passwords only through the authenticated internal context endpoint and never writes them locally. Cancellation prevents subsequent mutations, although a WordPress request already in progress may finish. Start the scheduler with `php artisan schedule:work`; it recovers expired heartbeats up to `max_attempts`.

## Network-independent API path

```text
browser ─▶ public API                         (direct mode)
browser ─▶ dashboard /api/proxy ─▶ API       (proxy mode)
```

Set `NEXT_PUBLIC_USE_PROXY=true` to select the second topology and provide the dashboard server with `API_INTERNAL_URL`. No application code changes are required between Docker, Railway, Vercel, or Kubernetes. Keep the internal URL server-only. Use `/api/health` for dependency-aware health data and the authenticated, owner/admin-only `/api/debug/environment` endpoint for safe deployment diagnostics.

# Rollback snapshot transport limits

Rollback capture is mandatory and completes before any WordPress write. Snapshots are gzip-compressed,
uploaded as idempotent checksum-addressed chunks, reassembled on the API filesystem, and verified against
their uncompressed SHA-256 checksum. `DEPLOYMENT_SNAPSHOT_CHUNK_MAX_BYTES` (default 512 KiB) is deliberately
below the configured Railway edge, Next.js proxy, and Laravel/PHP body limits; those infrastructure limits
must each be explicitly configured above the chunk size. The internal HTTP client imposes no separate body
limit. `DEPLOYMENT_SNAPSHOT_MAX_BYTES` (default 100 MiB uncompressed) is the application-level artifact cap.
The dashboard does not proxy internal Worker uploads. Operators should verify Railway's configured limit at
deployment time rather than relying on an undocumented platform default.

Artifacts contain a manifest/index and resource-oriented page, Elementor document, SEO, menu, homepage,
site-setting, and media-reference data. Elementor JSON must occur only in its dedicated resource, not be
duplicated in page metadata. Run `php artisan deployments:repair-stuck --deployment=<id>` to audit duplicate
starts and repair an active record that already has a terminal non-retryable event; the command preserves all
historical events.
