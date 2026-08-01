# Deploying to Railway

The application is deployed as four services from this repository, plus Railway PostgreSQL and Redis services. All application services must use the **repository root** as their root directory so Docker can access the workspace packages and lockfile.

## 1. Provision the project

1. Create a Railway project and add PostgreSQL and Redis.
2. Add four services from this GitHub repository: `api`, `dashboard`, `worker`, and `scheduler`.
3. Leave each service root directory at `/` and set its config-as-code file to:
   - API: `/apps/api/railway.toml`
   - Dashboard: `/apps/dashboard/railway.toml`
   - Worker: `/apps/worker/railway.toml`
   - Scheduler: `/apps/api/railway.scheduler.toml`
4. Generate public domains for the API and dashboard. The worker and scheduler must not have public domains.

The API config runs migrations as a pre-deploy command and uses Laravel's dedicated `/up` health endpoint. Every container listens on Railway's injected `PORT` where applicable.

Registration email is asynchronous. Configure the production mail transport, `MAIL_FROM_ADDRESS`, and `MAIL_FROM_NAME` on the API, keep `QUEUE_CONNECTION=redis`, and run a Laravel queue worker. Production startup rejects invalid or placeholder sender settings before the service accepts traffic; `MAIL_MAILER=log` is reserved for staging environments where delivery is intentionally disabled.

## 2. Configure variables

Use Railway reference variables for database and Redis connection strings rather than copying credentials. Variable names below are the names consumed by the applications.

### API

```dotenv
APP_ENV=production
APP_DEBUG=false
APP_KEY=<output of: php artisan key:generate --show>
APP_URL=https://<api-domain>
LOG_CHANNEL=stderr
DB_CONNECTION=pgsql
DB_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
CACHE_STORE=redis
QUEUE_CONNECTION=redis
SESSION_DRIVER=redis
SESSION_SECURE_COOKIE=true
SESSION_SAME_SITE=none
SANCTUM_STATEFUL_DOMAINS=<dashboard-domain>,<api-domain>
CORS_ALLOWED_ORIGINS=https://<dashboard-domain>
DASHBOARD_URL=https://<dashboard-domain>
INTERNAL_WORKER_TOKEN=<at-least-32-random-characters>
```

Set `APP_KEY` to the command's actual output (including its `base64:` prefix), not
to the example placeholder. The API also normalizes a non-empty Railway-managed
plain-text secret into a stable AES-256 key, so an existing plain-text value no
longer causes the `/up` health check to return HTTP 500. Keep the value unchanged
after launch: changing it invalidates encrypted cookies and stored WordPress
credentials.

Add production mail, Stripe, OpenAI, and S3-compatible media variables from `apps/api/.env.example` when those features are enabled. Do not use the local filesystem for durable media because Railway service filesystems are ephemeral; configure `MEDIA_DISK=media-s3` and the `MEDIA_S3_*` variables.

### Dashboard

```dotenv
NEXT_PUBLIC_USE_PROXY=true
NEXT_PUBLIC_API_URL=/api/proxy/api
API_INTERNAL_URL=http://api-service.railway.internal:8080
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<optional-publishable-key>
```

`NEXT_PUBLIC_*` values are embedded by Next.js during the Docker build, so redeploy the dashboard after changing them. Proxy mode sends browser API calls through `/api/proxy/api` and the Sanctum cookie request through `/api/proxy/sanctum/csrf-cookie`. `API_INTERNAL_URL` is server-only and is never included in the browser bundle; set its host and port to the API service's Railway private-network address. Railway is automatically detected through `RAILWAY_ENVIRONMENT_NAME` and secure cookie defaults are applied.

### Worker

```dotenv
REDIS_URL=${{Redis.REDIS_URL}}
API_INTERNAL_BASE_URL=https://<api-domain>/api/internal
INTERNAL_WORKER_TOKEN=<same-value-as-api>
WORKER_CONCURRENCY=2
JOB_HEARTBEAT_INTERVAL_MS=15000
AI_PROVIDER=mock
```

Copy provider and media variables from `apps/worker/.env.example`. The internal worker token must exactly match the API value.

## 3. Run the scheduler

The `scheduler` service uses `/apps/api/railway.scheduler.toml`, which starts `php artisan schedule:work` and deliberately defines no HTTP health check. Do not use the API's `/apps/api/railway.toml` for this service: `/up` is served only by the API web process, so probing it on the scheduler will always fail even while scheduling is healthy. The scheduler should remain private and share the API's database, Redis, application key, and worker-token variables. Railway runs its pre-deploy migration as well; Laravel migrations are idempotent.

## 4. Verify the deployment

1. Confirm the API deployment and migration complete successfully.
2. Open `https://<api-domain>/up` and confirm it returns a successful response.
3. Open the dashboard, register a user, and confirm authenticated API requests succeed.
4. Confirm the worker logs contain `Website Generator worker ready` and scheduler logs remain active.
5. Trigger a mock generation and verify it reaches a terminal successful state.

Keep the API, worker, and scheduler on Railway's private network whenever a public URL is not required. Only the API and dashboard need public ingress.

For a customer-flow staging pass, follow `docs/customer-product-completion.md`. In particular, run both the queue worker and scheduler services before submitting the wizard; queued progress without new persisted events is presented as a worker/queue delay rather than fabricated progress.
