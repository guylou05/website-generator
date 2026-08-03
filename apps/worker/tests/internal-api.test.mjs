import assert from 'node:assert/strict';
import test from 'node:test';
import { InternalApiClient, InternalApiError } from '../dist/internal-api.js';

test('classifies HTTP 413 as a typed non-retryable rollback snapshot failure', async (t) => {
  t.mock.method(
    globalThis,
    'fetch',
    async () =>
      new Response(
        JSON.stringify({
          error: {
            code: 'rollback_snapshot_too_large',
            size_bytes: 12_582_912,
            limit_bytes: 10_485_760,
          },
        }),
        { status: 413, headers: { 'content-type': 'application/json' } },
      ),
  );
  const client = new InternalApiClient('https://internal.test', 'secret');
  await assert.rejects(
    client.post(
      'deployments',
      '123e4567-e89b-42d3-a456-426614174000',
      'rollback-snapshot/init',
      {},
    ),
    (error) => {
      assert.ok(error instanceof InternalApiError);
      assert.equal(error.details.status, 413);
      assert.equal(error.details.retryable, false);
      assert.equal(error.details.classification, 'non_retryable_data_error');
      assert.equal(error.details.code, 'rollback_snapshot_too_large');
      return true;
    },
  );
  assert.equal(globalThis.fetch.mock.callCount(), 1);
});

test('classifies client errors as non-retryable', async (t) => {
  for (const status of [400, 401, 403, 404, 409, 422]) {
    t.mock.method(
      globalThis,
      'fetch',
      async () => new Response('{}', { status }),
    );
    const client = new InternalApiClient('https://internal.test', 'secret');
    await assert.rejects(
      client.get('deployments', crypto.randomUUID(), 'context'),
      (error) => {
        assert.equal(error.details.retryable, false);
        return true;
      },
    );
    globalThis.fetch.mock.restore();
  }
});
