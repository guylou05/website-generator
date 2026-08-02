export const HOP_BY_HOP_HEADERS = new Set([
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

export const NULL_BODY_STATUSES = new Set([204, 205, 304]);

export async function bufferUpstreamResponse(
  upstream: Response,
  requestId: string,
  setCookies: string[] = [],
): Promise<Response> {
  const safeHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    const normalizedKey = key.toLowerCase();
    // Cookies are appended individually below; folding them can corrupt Expires.
    if (
      !HOP_BY_HOP_HEADERS.has(normalizedKey) &&
      normalizedKey !== 'set-cookie'
    )
      safeHeaders.append(key, value);
  });
  safeHeaders.set('cache-control', 'no-store');
  safeHeaders.set('x-request-id', requestId);
  for (const cookie of setCookies) safeHeaders.append('set-cookie', cookie);

  // Fetch forbids bodies (including empty strings and buffers) for these
  // statuses. In particular, Laravel Sanctum legitimately returns 204.
  if (NULL_BODY_STATUSES.has(upstream.status))
    return new Response(null, {
      status: upstream.status,
      headers: safeHeaders,
    });

  // Undici streams must not escape the request which owns them. Buffer once,
  // then return a new stream owned by Next.js.
  const body = await upstream.text();
  return new Response(body, {
    status: upstream.status,
    headers: safeHeaders,
  });
}
