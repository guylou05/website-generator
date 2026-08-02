import { NextRequest } from 'next/server';
import { rewriteSetCookieForProxy } from '@/lib/cookies';
import { internalApiBase } from '@/lib/runtime-config.server';
import {
  bufferedProxyResponse,
  copyProxyRequestHeaders,
  proxyErrorResponse,
  proxyTimeoutMs,
} from '@/lib/api-proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function upstreamUrl(path: string[], search: string): string {
  const base = internalApiBase();
  if (path[0] === 'sanctum')
    return `${base.replace(/\/api$/, '')}/${path.join('/')}${search}`;
  // Browser API requests include `/api` after the proxy prefix. The configured
  // upstream base already ends in `/api`, so consume that segment once.
  const apiPath = path[0] === 'api' ? path.slice(1) : path;
  return `${base}/${apiPath.join('/')}${search}`;
}

async function proxy(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const headers = copyProxyRequestHeaders(request.headers);
  headers.set('accept-encoding', 'identity');
  headers.set('x-forwarded-host', request.nextUrl.host);
  headers.set('x-forwarded-proto', request.nextUrl.protocol.replace(':', ''));
  const hasBody = !['GET', 'HEAD'].includes(request.method);
  const url = upstreamUrl(path, request.nextUrl.search);
  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort('upstream timeout'), proxyTimeoutMs);
  try {
    const upstream = await fetch(url, {
      method: request.method, headers, body: hasBody ? request.body : undefined,
      cache: 'no-store', redirect: 'manual', signal: controller.signal,
      ...(hasBody ? { duplex: 'half' } : {}),
    } as RequestInit & { duplex?: 'half' });
    const response = await bufferedProxyResponse(upstream, (cookie) =>
      rewriteSetCookieForProxy(cookie, request.nextUrl.protocol === 'https:'),
    );
    console.info('dashboard_api_proxy', {
      method: request.method, path: new URL(url).pathname, status: upstream.status,
      contentType: upstream.headers.get('content-type'), durationMs: Date.now() - started,
    });
    return response;
  } catch {
    const timedOut = controller.signal.aborted;
    console.error('dashboard_api_proxy_failed', {
      method: request.method, path: new URL(url).pathname,
      durationMs: Date.now() - started, reason: timedOut ? 'timeout' : 'upstream fetch failed',
    });
    return proxyErrorResponse(timedOut ? 504 : 502,
      timedOut ? 'The API timed out. Please retry.' : 'The API is unavailable. Please retry.');
  } finally {
    clearTimeout(timeout);
  }
}

export const GET = proxy;
export const HEAD = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
