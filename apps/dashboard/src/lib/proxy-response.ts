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

export async function bufferUpstreamResponse(
  upstream: Response,
  requestId: string,
  setCookies: string[] = [],
): Promise<Response> {
  // Undici streams must not escape the request which owns them. Buffer once,
  // then return a new stream owned by Next.js.
  const body = await upstream.text();
  const headers = new Headers({
    'content-type': upstream.headers.get('content-type') ?? 'application/json',
    'cache-control': 'no-store',
    'x-request-id': requestId,
  });
  for (const cookie of setCookies) headers.append('set-cookie', cookie);
  return new Response(body, { status: upstream.status, headers });
}
