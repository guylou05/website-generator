# API-to-worker job transport

Generation and deployment use a deliberately language-neutral Redis list
protocol, not Laravel queues or BullMQ. Both processes connect to `REDIS_URL`
and `REDIS_QUEUE_DB` (default `0`). The ready list keys are:

- `sitefoundry:queue:website-generation`
- `sitefoundry:queue:wordpress-deployment`

The prefix and queue portions are configurable with `REDIS_QUEUE_PREFIX`,
`GENERATION_QUEUE_NAME`, and `DEPLOYMENT_QUEUE_NAME`. Laravel `LPUSH`es a JSON
object containing `version`, `type`, `uuid`, `attempt`, and `enqueued_at`. The
worker atomically `BRPOPLPUSH`es it to the corresponding `:reserved` list and
removes it after processing. Invalid payloads are moved to `:stale`; they are
never deserialized or executed. Before deploying the worker, run
`php artisan jobs:migrate-legacy --execute` once. It re-enqueues every queued
database record in the interoperable format and archives `queues:default` under
a clearly marked stale key. Run `php artisan jobs:diagnose` before and after the
deployment to identify old queue depth and configuration mismatches.

The worker obtains all sensitive execution data from the authenticated internal
API after receipt, so Redis payloads and logs contain only the job type and UUID.
Per-job Redis locks, API idempotency, cancellation checks, execution heartbeats,
and the scheduler's stale-job recovery remain in effect.
