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
