import assert from 'node:assert/strict';
import test from 'node:test';
import {
  bufferUpstreamResponse,
  HOP_BY_HOP_HEADERS,
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
