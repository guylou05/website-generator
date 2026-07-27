import { NextRequest } from 'next/server';
import { rewriteSetCookieForProxy } from '@/lib/cookies';
import { internalApiBase } from '@/lib/runtime-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

function upstreamUrl(path: string[], search: string): string {
  const base = internalApiBase();
  if (path[0] === 'sanctum')
    return `${base.replace(/\/api$/, '')}/${path.join('/')}${search}`;
  return `${base}/${path.join('/')}${search}`;
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
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) headers.set(key, value);
  });
  headers.set('accept-encoding', 'identity');
  headers.set('x-forwarded-host', request.nextUrl.host);
  headers.set('x-forwarded-proto', request.nextUrl.protocol.replace(':', ''));
  const hasBody = !['GET', 'HEAD'].includes(request.method);
  const upstream = await fetch(upstreamUrl(path, request.nextUrl.search), {
    method: request.method,
    headers,
    body: hasBody ? request.body : undefined,
    cache: 'no-store',
    redirect: 'manual',
    ...(hasBody ? { duplex: 'half' } : {}),
  } as RequestInit & { duplex?: 'half' });

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (
      !HOP_BY_HOP.has(key.toLowerCase()) &&
      key.toLowerCase() !== 'set-cookie'
    )
      responseHeaders.set(key, value);
  });
  const secure = request.nextUrl.protocol === 'https:';
  for (const cookie of getSetCookies(upstream.headers))
    responseHeaders.append(
      'set-cookie',
      rewriteSetCookieForProxy(cookie, secure),
    );
  responseHeaders.set('cache-control', 'no-store');
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export const GET = proxy;
export const HEAD = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
