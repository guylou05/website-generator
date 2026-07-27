# Docker development

Copy `.env.example`, `apps/api/.env.example`, `apps/dashboard/.env.example`, and `apps/worker/.env.example` to their corresponding `.env` files. Generate the API key with `docker compose run --rm api php artisan key:generate`, then run:

```bash
docker compose up --build
```

Direct mode is the default at `http://localhost:8080/api`. Set `NEXT_PUBLIC_USE_PROXY=true` before building the dashboard to exercise the same-origin path used by Vercel; Docker supplies `API_INTERNAL_URL=http://nginx/api`.
