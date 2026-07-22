# Architecture

## System context

Website Generator is separated into independently deployable entry points and reusable capability packages. The dashboard communicates with the Laravel API over HTTP. Long-running generation work will be published to Redis-backed queues and consumed by the worker. PostgreSQL is the system of record; Redis is ephemeral infrastructure for queues, cache, and sessions.

```text
Browser -> Dashboard -> API -> PostgreSQL
                         |
                         +-> Redis queue -> Worker -> generation integrations
```

## Boundaries

- `apps/dashboard` owns routing and the user-facing application shell. It must not connect directly to persistence or AI providers.
- `apps/api` owns authentication, authorization, validation, persistence, and public HTTP contracts.
- `apps/worker` owns asynchronous execution and imports capability packages rather than embedding provider-specific workflows.
- `packages/ai` will expose provider-neutral model and orchestration contracts.
- `packages/renderer` will turn validated site specifications into renderable output.
- `packages/wordpress` will isolate WordPress publishing and synchronization.
- `packages/design-system` owns reusable visual primitives and tokens.
- `packages/shared` contains stable, environment-agnostic types and utilities. It must not depend on applications.

Packages are intentionally empty public entry points at initialization. New code should depend inward on contracts and avoid cross-application imports.

## Operational principles

- Configuration is supplied through environment variables; secrets never receive repository defaults.
- PostgreSQL data and Redis append-only data use named local volumes.
- Containers use health checks for infrastructure dependencies.
- API and worker tasks must be idempotent before retries are enabled.
- Generated sites and model outputs should be treated as untrusted input and validated before storage or rendering.
- Provider calls should eventually include timeouts, bounded retries, observability, cost attribution, and tenant-aware rate limits.
- CI is the minimum quality gate for formatting, linting, type checking, builds, and tests.

## AI generation pipeline

The provider-neutral generation pipeline is documented in [`packages/ai/README.md`](../packages/ai/README.md). Applications inject each asynchronous stage, logging, and retry behavior. The final stage produces the shared Website Blueprint; provider SDK types and renderer-specific output must remain outside the pipeline contracts.

## Project and generation persistence

Laravel is the sole owner of project persistence. `projects` stores business and brand inputs; UUID-addressed `generation_runs` stores provider-neutral input, lifecycle state, safe errors, blueprint output, and Elementor output; append-only `generation_events` provides the timeline. The dashboard only accesses these records through typed HTTP resources. Generation is synchronous for the current mock provider, while the data model and event stream allow a queue worker to be introduced without changing dashboard routes. Provider keys are environment-only server secrets and are excluded from every persisted input and resource. Authentication, image generation, and WordPress deployment are deliberately outside this boundary.

## WordPress deployment boundary

Laravel normalizes destinations, rejects unsafe production network targets, encrypts Application Passwords, verifies WordPress, Elementor, connector endpoints, and administrator capabilities, then records every deployment stage. A successful dry run is required before mutation. Page lookup by slug and connector upserts make retries idempotent. Next.js orchestrates these endpoints but never receives stored credentials.

## Durable job boundary

Laravel/PostgreSQL are authoritative. Public controllers only validate, create `queued` records/events, and enqueue marker jobs containing one UUID. The TypeScript worker reserves Laravel Redis queue messages, uses a per-job distributed lock, and calls authenticated internal APIs for execution context, progress, heartbeat, cancellation and idempotent terminal callbacks. Event UUID uniqueness makes replay safe.

States are `queued`, `running`, `cancelling`, `cancelled`, `succeeded`, `failed`, and `stale`. Retry creates a new record for public retries; automatic stale recovery increments the existing attempt and redispatches while attempts remain. `php artisan jobs:recover-stale` is scheduled every minute. The dashboard should poll the persisted resource/event timeline with backoff (immediate while connected, slower on errors), reconnect after network loss, and redirect only after observing `succeeded`.

The internal bearer token is compared in constant time. Execution contexts are never public; deployment credentials are decrypted only for the authenticated worker. Rotate the token with a coordinated API/worker restart. Cancellation is cooperative; an already-running remote HTTP request may finish.

## Identity and tenant boundary

Laravel is the identity and authorization authority. Sanctum stateful SPA middleware authenticates the Next.js dashboard with an encrypted, HttpOnly, SameSite cookie and CSRF double-submit protection. Public domain APIs require an authenticated active membership; organization IDs are derived from `User.current_organization_id`, never request data. Tenant-aware route binding filters projects, generation runs, WordPress connections, and deployments before controllers execute, producing a non-disclosing 404 across tenants.

Roles are centralized in `OrganizationPolicy` and tenant middleware: owners control ownership/deletion, admins manage organization resources and members, members manage workload resources, and viewers are read-only. Internal execution routes remain isolated behind `INTERNAL_WORKER_TOKEN`; worker authentication is independent of browser sessions.

## Billing boundary

Laravel maps Stripe prices to stable internal plans and is the subscription/usage system of record. The dashboard only requests hosted Checkout or Portal URLs. Workers retain `INTERNAL_WORKER_TOKEN` authentication and receive an authoritative plan/provider snapshot before external mutations.
