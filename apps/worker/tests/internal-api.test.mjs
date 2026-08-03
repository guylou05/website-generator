import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DeploymentConflictError,
  InternalApiClient,
  PermanentApiError,
  RetryableApiError,
} from '../dist/internal-api.js';

const deploymentId = '123e4567-e89b-42d3-a456-426614174000';

test('2xx response succeeds', async (t) => {
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ data: { ok: true } }),
  );
  const result = await new InternalApiClient(
    'https://internal.test',
    'secret',
  ).get('deployments', deploymentId, 'execution-context');
  assert.deepEqual(result, { data: { ok: true } });
});

test('deployment claim 409 is a permanent typed conflict', async (t) => {
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json(
      { error: { code: 'lease_owned_by_another_worker' } },
      { status: 409 },
    ),
  );
  await assert.rejects(
    new InternalApiClient('https://internal.test', 'secret').post(
      'deployments',
      deploymentId,
      'started',
      {},
    ),
    (error) => {
      assert.ok(error instanceof DeploymentConflictError);
      assert.equal(error.retryable, false);
      assert.equal(error.details.status, 409);
      assert.equal(error.details.code, 'lease_owned_by_another_worker');
      return true;
    },
  );
  assert.equal(globalThis.fetch.mock.callCount(), 1);
});

test('400, 401, 403, 404, 409, 413, and 422 are permanent', async (t) => {
  for (const status of [400, 401, 403, 404, 409, 413, 422]) {
    t.mock.method(
      globalThis,
      'fetch',
      async () => new Response('{}', { status }),
    );
    await assert.rejects(
      new InternalApiClient('https://internal.test', 'secret').get(
        'deployments',
        deploymentId,
        'execution-context',
      ),
      (error) =>
        error instanceof PermanentApiError && error.retryable === false,
    );
    globalThis.fetch.mock.restore();
  }
});

test('only transient server statuses are retryable', async (t) => {
  for (const status of [500, 502, 503, 504]) {
    t.mock.method(
      globalThis,
      'fetch',
      async () => new Response('{}', { status }),
    );
    await assert.rejects(
      new InternalApiClient('https://internal.test', 'secret').get(
        'deployments',
        deploymentId,
        'execution-context',
      ),
      (error) => error instanceof RetryableApiError && error.retryable === true,
    );
    globalThis.fetch.mock.restore();
  }
});

test('network timeout is retryable', async (t) => {
  const timeout = new Error('request timed out');
  timeout.name = 'AbortError';
  t.mock.method(globalThis, 'fetch', async () => {
    throw timeout;
  });
  await assert.rejects(
    new InternalApiClient('https://internal.test', 'secret').get(
      'deployments',
      deploymentId,
      'execution-context',
    ),
    (error) => {
      assert.ok(error instanceof RetryableApiError);
      assert.equal(error.details.code, 'network_timeout');
      return true;
    },
  );
});
