# Environment configuration

## Deployment matrix

| Target                     | Dashboard browser configuration      | Dashboard server configuration               | API cookies       |
| -------------------------- | ------------------------------------ | -------------------------------------------- | ----------------- |
| Docker Compose             | public localhost URL, proxy optional | `http://nginx/api`                           | host-only/Lax     |
| Railway staging/production | public API URL or proxy              | `API_INTERNAL_URL` or Railway private domain | proxy recommended |
| Vercel + Railway           | `NEXT_PUBLIC_USE_PROXY=true`         | Railway public API URL in `API_INTERNAL_URL` | host-only/Lax     |
| Kubernetes                 | ingress API URL or proxy             | cluster Service URL                          | host-only/Lax     |

```text
Build-time public values: NEXT_PUBLIC_* ──▶ browser bundle
Runtime private values:   API_INTERNAL_URL ──▶ Next.js route only
```

Laravel validates production configuration during boot and reports all missing or inconsistent settings together. Required infrastructure includes `APP_KEY`, `APP_URL`, database settings and Redis when it backs sessions. The authenticated admin endpoint `GET /api/debug/environment` exposes only an explicit safe list; it never dumps process environment or secrets.
