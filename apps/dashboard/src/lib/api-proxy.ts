const HOP_BY_HOP = new Set([
  'connection',
  'content-length',
  'host',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

export const proxyTimeoutMs = 15_000;

export function copyProxyRequestHeaders(source: Headers): Headers {
  const headers = new Headers();
  source.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) headers.set(key, value);
  });
  return headers;
}

function getSetCookies(headers: Headers): string[] {
  const extended = headers as Headers & { getSetCookie?: () => string[] };
  if (extended.getSetCookie) return extended.getSetCookie();
  const value = headers.get('set-cookie');
  return value ? [value] : [];
}

/** Buffer the upstream body so Undici owns and finishes its stream before Next
 * starts sending a response. In particular, never forward transfer framing or
 * an upstream content-length which may no longer describe the new response. */
export async function bufferedProxyResponse(
  upstream: Response,
  rewriteCookie: (cookie: string) => string,
): Promise<Response> {
  const body =
    upstream.status === 204 || upstream.status === 304
      ? null
      : await upstream.text();
  const headers = new Headers();
  upstream.headers.forEach((value, key) => {
    if (
      !HOP_BY_HOP.has(key.toLowerCase()) &&
      key.toLowerCase() !== 'set-cookie'
    )
      headers.set(key, value);
  });
  for (const cookie of getSetCookies(upstream.headers))
    headers.append('set-cookie', rewriteCookie(cookie));
  headers.set(
    'content-type',
    upstream.headers.get('content-type') ?? 'application/json',
  );
  headers.set('cache-control', 'no-store');
  return new Response(body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}

export function proxyErrorResponse(status: number, message: string): Response {
  return Response.json(
    {
      error: {
        code: status === 504 ? 'upstream_timeout' : 'upstream_unavailable',
        message,
      },
    },
    { status, headers: { 'cache-control': 'no-store' } },
  );
}
