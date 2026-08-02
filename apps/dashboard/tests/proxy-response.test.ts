import assert from 'node:assert/strict';
import test from 'node:test';
import {
  bufferUpstreamResponse,
  HOP_BY_HOP_HEADERS,
  NULL_BODY_STATUSES,
} from '../src/lib/proxy-response';

test('buffers chunked upstream bodies exactly once and drops stale length', async () => {
  let pulls = 0;
  const upstream = new Response(
    new ReadableStream({
      pull(controller) {
        pulls += 1;
        controller.enqueue(new TextEncoder().encode('{"data":[] }'));
        controller.close();
      },
    }),
    {
      headers: {
        'content-type': 'application/json',
        'content-length': '999',
        'transfer-encoding': 'chunked',
      },
    },
  );

  const response = await bufferUpstreamResponse(upstream, 'request-1');
  assert.equal(await response.text(), '{"data":[] }');
  assert.equal(pulls, 1);
  assert.equal(response.headers.get('content-length'), null);
  assert.equal(response.headers.get('transfer-encoding'), null);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-request-id'), 'request-1');
});

test('hop-by-hop response headers are explicitly forbidden', () => {
  for (const header of [
    'connection',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailer',
    'transfer-encoding',
    'upgrade',
    'content-length',
  ])
    assert.ok(HOP_BY_HOP_HEADERS.has(header));
});

for (const status of [204, 205, 304]) {
  test(`returns upstream ${status} with a null downstream body`, async () => {
    const upstream = new Response(null, { status });
    const response = await bufferUpstreamResponse(
      upstream,
      `request-${status}`,
    );

    assert.equal(NULL_BODY_STATUSES.has(status), true);
    assert.equal(response.status, status);
    assert.equal(response.body, null);
    assert.equal(await response.text(), '');
  });
}

test('preserves separate Sanctum cookies and their attributes on a 204', async () => {
  const cookies = [
    'XSRF-TOKEN=token; Path=/; Expires=Wed, 21 Oct 2037 07:28:00 GMT; SameSite=Lax; Secure',
    'website_generator_session=session; Path=/; HttpOnly; SameSite=Lax; Secure',
  ];
  const response = await bufferUpstreamResponse(
    new Response(null, { status: 204 }),
    'csrf-request',
    cookies,
  );
  const getSetCookie = (
    response.headers as Headers & {
      getSetCookie?: () => string[];
    }
  ).getSetCookie;

  assert.equal(response.status, 204);
  assert.equal(response.body, null);
  assert.deepEqual(getSetCookie?.call(response.headers), cookies);
});

test('preserves normal JSON and upstream error response bodies', async () => {
  for (const [status, body] of [
    [200, '{"data":{"ok":true}}'],
    [422, '{"error":{"message":"Invalid input"}}'],
  ] as const) {
    const response = await bufferUpstreamResponse(
      new Response(body, {
        status,
        headers: {
          'content-type': 'application/json',
          connection: 'close',
          'content-length': String(body.length),
        },
      }),
      `request-${status}`,
    );
    assert.equal(response.status, status);
    assert.equal(await response.text(), body);
    assert.equal(response.headers.get('content-type'), 'application/json');
    assert.equal(response.headers.get('connection'), null);
    assert.equal(response.headers.get('content-length'), null);
  }
});
