# Authentication and API transport

The dashboard depends on the `AuthProvider` contract, not Laravel Sanctum. The current `SanctumAuthProvider` uses encrypted server-side sessions. A future Passport/OAuth provider can implement the same contract without changing pages.

```text
Direct: browser ──credentials + XSRF──▶ Laravel API
Proxy:  browser ──host-only cookies──▶ Next.js ──private URL──▶ Laravel API
```

## Choosing a transport

| Variable | Visibility | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | browser | Public Laravel URL ending in `/api` |
| `NEXT_PUBLIC_USE_PROXY` | browser | `true` selects `/api/proxy`; otherwise direct |
| `API_INTERNAL_URL` | server only | Private Laravel base ending in `/api` |
| `NEXT_PUBLIC_AUTH_DRIVER` | browser | `sanctum` (the only installed provider) |

The client normalizes trailing slashes, coalesces simultaneous CSRF requests, adds the decoded `X-XSRF-TOKEN`, and retries one time after HTTP 401/419. The proxy forwards request/response streams and rewrites API cookies as host-only.

### Cookie modes

Use host-only, `SameSite=Lax` cookies with the proxy. For genuinely cross-site direct mode use HTTPS, `SESSION_SECURE_COOKIE=true`, and `SESSION_SAME_SITE=none`. A parent `SESSION_DOMAIN=.example.com` is appropriate only when both applications are subdomains of the same registrable domain. Never include a scheme, path, or port in `SESSION_DOMAIN`.
