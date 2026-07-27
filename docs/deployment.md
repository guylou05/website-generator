# Deployment jobs

A successful generation and successful dry-run preview are required before live deployment. Only one active live deployment per project is allowed. Submit `POST /api/projects/{project}/deployments/preview`, observe the persisted result, and then submit `POST /api/projects/{project}/deployments`; both return 202.

The worker receives decrypted Application Passwords only through the authenticated internal context endpoint and never writes them locally. Cancellation prevents subsequent mutations, although a WordPress request already in progress may finish. Start the scheduler with `php artisan schedule:work`; it recovers expired heartbeats up to `max_attempts`.

## Network-independent API path

```text
browser ─▶ public API                         (direct mode)
browser ─▶ dashboard /api/proxy ─▶ API       (proxy mode)
```

Set `NEXT_PUBLIC_USE_PROXY=true` to select the second topology and provide the dashboard server with `API_INTERNAL_URL`. No application code changes are required between Docker, Railway, Vercel, or Kubernetes. Keep the internal URL server-only. Use `/api/health` for dependency-aware health data and the authenticated, owner/admin-only `/api/debug/environment` endpoint for safe deployment diagnostics.
