import { NextRequest } from 'next/server';
import { rewriteSetCookieForProxy } from '@/lib/cookies';
import { internalApiBase } from '@/lib/runtime-config.server';
import {
  bufferUpstreamResponse,
  HOP_BY_HOP_HEADERS,
} from '@/lib/proxy-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REQUEST_TIMEOUT_MS = 30_000;

function upstreamUrl(path: string[], search: string): string {
  const base = internalApiBase();
  if (path[0] === 'sanctum')
    return `${base.replace(/\/api$/, '')}/${path.join('/')}${search}`;
  // Browser API requests include `/api` after the proxy prefix. The configured
  // upstream base already ends in `/api`, so consume that segment once.
  const apiPath = path[0] === 'api' ? path.slice(1) : path;
  return `${base}/${apiPath.join('/')}${search}`;
}

function getSetCookies(headers: Headers): string[] {
  const extended = headers as Headers & { getSetCookie?: () => string[] };
  if (extended.getSetCookie) return extended.getSetCookie();
  const value = headers.get('set-cookie');
  return value ? [value] : [];
}

async function proxy(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  const startedAt = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort('upstream_timeout'),
    REQUEST_TIMEOUT_MS,
  );
  const target = upstreamUrl(path, request.nextUrl.search);
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) headers.set(key, value);
  });
  headers.set('x-request-id', requestId);
  headers.set('accept-encoding', 'identity');
  headers.set('x-forwarded-host', request.nextUrl.host);
  headers.set('x-forwarded-proto', request.nextUrl.protocol.replace(':', ''));
  const hasBody = !['GET', 'HEAD'].includes(request.method);
  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? request.body : undefined,
      signal: controller.signal,
      cache: 'no-store',
      redirect: 'manual',
      ...(hasBody ? { duplex: 'half' } : {}),
    } as RequestInit & { duplex?: 'half' });
    const secure = request.nextUrl.protocol === 'https:';
    const cookies = getSetCookies(upstream.headers).map((cookie) =>
      rewriteSetCookieForProxy(cookie, secure),
    );
    const response = await bufferUpstreamResponse(upstream, requestId, cookies);
    console.info(
      JSON.stringify({
        event: 'dashboard_api_proxy',
        requestId,
        route: request.nextUrl.pathname,
        upstreamPath: new URL(target).pathname,
        method: request.method,
        status: upstream.status,
        contentType: upstream.headers.get('content-type'),
        durationMs: Math.round(performance.now() - startedAt),
        abortReason: null,
        bodyBuffered: true,
      }),
    );
    return response;
  } catch (error) {
    const timedOut = controller.signal.aborted;
    console.error(
      JSON.stringify({
        event: 'dashboard_api_proxy_error',
        requestId,
        route: request.nextUrl.pathname,
        upstreamPath: new URL(target).pathname,
        method: request.method,
        status: timedOut ? 504 : 502,
        contentType: 'application/json',
        durationMs: Math.round(performance.now() - startedAt),
        abortReason: timedOut ? String(controller.signal.reason) : null,
        bodyBuffered: false,
        errorName: error instanceof Error ? error.name : 'UnknownError',
        stack: error instanceof Error ? error.stack : undefined,
      }),
    );
    return Response.json(
      {
        error: {
          code: timedOut ? 'upstream_timeout' : 'upstream_failure',
          message: timedOut
            ? 'The API request timed out. Please retry.'
            : 'The API request failed.',
          request_id: requestId,
        },
      },
      {
        status: timedOut ? 504 : 502,
        headers: { 'cache-control': 'no-store', 'x-request-id': requestId },
      },
    );
  } finally {
    clearTimeout(timer);
  }
}

export const GET = proxy;
export const HEAD = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
