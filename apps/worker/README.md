# Asynchronous worker

The worker is the only production process that invokes AI providers and WordPress. Laravel owns state and places UUID-only marker jobs on its Redis queue; worker consumers reserve those messages, acquire `job-lock:<kind>:<uuid>`, fetch an authenticated execution context, and report persisted events, heartbeat, and terminal state.

```bash
pnpm --filter @website-generator/worker dev
# or: docker compose up worker
```

Set `API_INTERNAL_BASE_URL`, `REDIS_URL`, `INTERNAL_WORKER_TOKEN`, `WORKER_CONCURRENCY`, and `JOB_HEARTBEAT_INTERVAL_MS`. The token must be random and shared only between API and worker. Rotate it during a coordinated restart: stop consumers, update both environments, restart API and consumers. It is redacted from structured logs.

Cancellation is cooperative between stages and before WordPress deployment. A remote WordPress request already in flight can finish before cancellation takes effect. Credentials exist only in memory for the duration of a deployment.
