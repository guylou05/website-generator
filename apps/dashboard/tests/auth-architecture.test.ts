import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { DashboardApiClient } from '../src/lib/api-client';
import { readCookie, rewriteSetCookieForProxy } from '../src/lib/cookies';
import { browserApiBase } from '../src/lib/runtime-config';

test('selects direct and proxy browser configuration', () => {
  assert.equal(
    browserApiBase({ NEXT_PUBLIC_API_URL: 'http://localhost:8080/api/' }),
    'http://localhost:8080/api',
  );
  assert.equal(
    browserApiBase({
      NEXT_PUBLIC_USE_PROXY: 'true',
      NEXT_PUBLIC_API_URL: 'https://public/api',
    }),
    '/api/proxy',
  );
});

test('production proxy configuration never silently falls back to localhost', () => {
  assert.equal(
    browserApiBase({
      NODE_ENV: 'production',
      NEXT_PUBLIC_USE_PROXY: 'true',
    }),
    '/api/proxy',
  );
  assert.throws(
    () =>
      browserApiBase({
        NODE_ENV: 'production',
        NEXT_PUBLIC_API_URL: '/api/proxy/api',
      }),
    /NEXT_PUBLIC_USE_PROXY must be true/,
  );
});

test('cookies decode safely and proxy cookies become host-only', () => {
  assert.equal(readCookie('XSRF-TOKEN', 'a=1; XSRF-TOKEN=a%2Bb%3D'), 'a+b=');
  const rewritten = rewriteSetCookieForProxy(
    'session=x; Domain=api.example.com; Path=/; SameSite=None; Secure',
  );
  assert.doesNotMatch(rewritten, /Domain=/i);
  assert.match(rewritten, /SameSite=None/);
  assert.match(rewritten, /Secure/);
});

test('deduplicates concurrent CSRF initialization and preserves fetch binding', async () => {
  let calls = 0;
  const receiver = {
    fetch: async function (this: unknown) {
      assert.equal(this, receiver);
      calls++;
      return new Response(null, { status: 204 });
    },
  };
  const client = new DashboardApiClient(
    'https://api.test/api',
    receiver.fetch.bind(receiver) as typeof fetch,
  );
  await Promise.all([
    client.initializeCsrf(),
    client.initializeCsrf(),
    client.initializeCsrf(),
  ]);
  assert.equal(calls, 1);
});

test('retries an expired session exactly once', async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => {
    calls++;
    if (calls === 1)
      return Response.json({ error: { message: 'expired' } }, { status: 401 });
    return Response.json({ data: [] });
  };
  assert.deepEqual(
    await new DashboardApiClient('https://api.test/api/', fetcher).projects(),
    [],
  );
  assert.equal(calls, 2);
});

test('proxy mode uses same-origin CSRF and API paths', async () => {
  const urls: string[] = [];
  const fetcher: typeof fetch = async (input) => {
    urls.push(String(input));
    if (urls.length === 1) return new Response(null, { status: 204 });
    return Response.json({ data: null });
  };
  const client = new DashboardApiClient('/api/proxy/', fetcher);
  await client.login({ email: 'owner@example.com', password: 'secret' });
  await client.currentUser();
  assert.deepEqual(urls, [
    '/api/proxy/sanctum/csrf-cookie',
    '/api/proxy/api/auth/login',
    '/api/proxy/api/auth/user',
  ]);
});

test('server-only configuration is excluded from client modules', async () => {
  const runtimeConfig = await readFile(
    new URL('../src/lib/runtime-config.ts', import.meta.url),
    'utf8',
  );
  const apiClient = await readFile(
    new URL('../src/lib/api-client.ts', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(runtimeConfig, /API_INTERNAL_URL/);
  assert.doesNotMatch(apiClient, /API_INTERNAL_URL/);

  const serverConfig = await readFile(
    new URL('../src/lib/runtime-config.server.ts', import.meta.url),
    'utf8',
  );
  assert.match(serverConfig, /import 'server-only'/);
  assert.match(serverConfig, /API_INTERNAL_URL/);
});

test('Docker build exports every public Next.js setting', async () => {
  const dockerfile = await readFile(
    new URL('../Dockerfile', import.meta.url),
    'utf8',
  );
  for (const variable of [
    'NEXT_PUBLIC_API_URL',
    'NEXT_PUBLIC_USE_PROXY',
    'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  ]) {
    assert.match(dockerfile, new RegExp(`ARG ${variable}(?:\\n|\\r)`));
    assert.match(dockerfile, new RegExp(`ENV ${variable}=\\$${variable}`));
  }
});
