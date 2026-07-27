import assert from 'node:assert/strict';
import test from 'node:test';
import { DashboardApiClient } from '../src/lib/api-client';
import { readCookie, rewriteSetCookieForProxy } from '../src/lib/cookies';
import { browserApiBase, deploymentPlatform, internalApiBase } from '../src/lib/runtime-config';

test('selects local, direct, proxy, Railway, and Vercel configuration', () => {
  assert.equal(browserApiBase({ NEXT_PUBLIC_API_URL: 'http://localhost:8080/api/' }), 'http://localhost:8080/api');
  assert.equal(browserApiBase({ NEXT_PUBLIC_USE_PROXY: 'true', NEXT_PUBLIC_API_URL: 'https://public/api' }), '/api/proxy');
  assert.equal(internalApiBase({ COMPOSE_PROJECT_NAME: 'site' }), 'http://nginx/api');
  assert.equal(internalApiBase({ RAILWAY_ENVIRONMENT_NAME: 'production', RAILWAY_PRIVATE_DOMAIN: 'api.railway.internal' }), 'http://api.railway.internal/api');
  assert.equal(deploymentPlatform({ VERCEL: '1' }), 'vercel');
});

test('cookies decode safely and proxy cookies become host-only', () => {
  assert.equal(readCookie('XSRF-TOKEN', 'a=1; XSRF-TOKEN=a%2Bb%3D'), 'a+b=');
  const rewritten = rewriteSetCookieForProxy('session=x; Domain=api.example.com; Path=/; SameSite=None; Secure', true);
  assert.doesNotMatch(rewritten, /Domain=/i);
  assert.match(rewritten, /SameSite=Lax/);
  assert.match(rewritten, /Secure/);
});

test('deduplicates concurrent CSRF initialization and preserves fetch binding', async () => {
  let calls = 0;
  const receiver = { fetch: async function (this: unknown) { assert.equal(this, receiver); calls++; return new Response(null, { status: 204 }); } };
  const client = new DashboardApiClient('https://api.test/api', receiver.fetch.bind(receiver) as typeof fetch);
  await Promise.all([client.initializeCsrf(), client.initializeCsrf(), client.initializeCsrf()]);
  assert.equal(calls, 1);
});

test('retries an expired session exactly once', async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => {
    calls++;
    if (calls === 1) return Response.json({ error: { message: 'expired' } }, { status: 401 });
    return Response.json({ data: [] });
  };
  assert.deepEqual(await new DashboardApiClient('https://api.test/api/', fetcher).projects(), []);
  assert.equal(calls, 2);
});

test('proxy mode uses same-origin CSRF and API paths', async () => {
  const urls: string[] = [];
  const fetcher: typeof fetch = async (input) => {
    urls.push(String(input));
    if (urls.length === 1) return new Response(null, { status: 204 });
    return Response.json({ data: null });
  };
  await new DashboardApiClient('/api/proxy/', fetcher).logout();
  assert.deepEqual(urls, ['/api/proxy/sanctum/csrf-cookie', '/api/proxy/auth/logout']);
});
