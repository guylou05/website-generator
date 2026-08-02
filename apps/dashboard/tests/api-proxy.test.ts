import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { bufferedProxyResponse, copyProxyRequestHeaders, proxyErrorResponse } from '../src/lib/api-proxy';
import { DashboardApiClient, DashboardApiError } from '../src/lib/api-client';

test('buffers JSON, preserves status, and consumes the upstream body once', async () => {
  let pulls = 0;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('{"data":[{"id":1},{"id":2}]}'));
      controller.close();
    },
    pull() { pulls++; },
  });
  const upstream = new Response(stream, {
    status: 201,
    headers: { 'content-type': 'application/json', 'transfer-encoding': 'chunked', 'content-length': '999' },
  });
  const response = await bufferedProxyResponse(upstream, String);
  assert.equal(response.status, 201);
  assert.equal(response.headers.get('transfer-encoding'), null);
  assert.notEqual(response.headers.get('content-length'), '999');
  assert.deepEqual(await response.json(), { data: [{ id: 1 }, { id: 2 }] });
  assert.equal(upstream.bodyUsed, true);
  assert.ok(pulls <= 1);
});

test('supports an empty project list and upstream error responses', async () => {
  const empty = await bufferedProxyResponse(Response.json({ data: [] }), String);
  assert.deepEqual(await empty.json(), { data: [] });
  const failure = await bufferedProxyResponse(Response.json({ error: { message: 'failed' } }, { status: 500 }), String);
  assert.equal(failure.status, 500);
  assert.deepEqual(await failure.json(), { error: { message: 'failed' } });
});

test('does not forward hop-by-hop request headers', () => {
  const copied = copyProxyRequestHeaders(new Headers({ cookie: 'session=x', authorization: 'Bearer x', connection: 'close' }));
  assert.equal(copied.get('cookie'), 'session=x');
  assert.equal(copied.get('authorization'), 'Bearer x');
  assert.equal(copied.get('connection'), null);
});

test('returns controlled timeout JSON', async () => {
  const response = proxyErrorResponse(504, 'The API timed out. Please retry.');
  assert.equal(response.status, 504);
  assert.equal((await response.json()).error.code, 'upstream_timeout');
});

test('an aborted projects fetch becomes a controlled timeout error', async () => {
  const fetcher: typeof fetch = async (_input, init) => {
    init?.signal?.throwIfAborted();
    throw new DOMException('aborted', 'AbortError');
  };
  await assert.rejects(
    new DashboardApiClient('/api/proxy', fetcher).projects(),
    (error: unknown) => error instanceof DashboardApiError && error.status === 504,
  );
});

test('projects UI exits loading state and offers retry on failure', async () => {
  const source = await readFile(new URL('../src/app/dashboard/projects/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /\.finally\(\(\) => setLoading\(false\)\)/);
  assert.match(source, />\s*Retry\s*</);
  assert.match(source, /role="alert"/);
});

test('production command starts the monorepo standalone artifact', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as { scripts: { start: string } };
  assert.match(pkg.scripts.start, /node \.next\/standalone\/apps\/dashboard\/server\.js/);
  assert.doesNotMatch(pkg.scripts.start, /next start/);
});
