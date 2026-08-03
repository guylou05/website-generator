import assert from 'node:assert/strict';
import test from 'node:test';
import {
  consumeOne,
  decodeJob,
  queueKey,
  retryDelayMs,
} from '../dist/queue.js';
import {
  DeploymentConflictError,
  PermanentApiError,
  RetryableApiError,
} from '../dist/internal-api.js';

test('decodes the language-neutral Laravel envelope', () => {
  const payload = JSON.stringify({
    id: '123e4567-e89b-42d3-a456-426614174000',
    type: 'generation',
    resource_id: '123e4567-e89b-42d3-a456-426614174000',
    attempt: 1,
    created_at: '2026-08-01T00:00:00Z',
    idempotency_key: 'generation:123e4567-e89b-42d3-a456-426614174000:1',
  });
  assert.equal(decodeJob(payload).type, 'generation');
});

test('uses the documented prefixed queue key', () => {
  assert.equal(
    queueKey(
      {
        prefix: 'sitefoundry',
        generation: 'website-generation',
        deployment: 'wordpress-deployment',
        media: 'media-processing',
      },
      'website-generation',
    ),
    'sitefoundry:queue:website-generation',
  );
});

const config = {
  prefix: 'sitefoundry',
  generation: 'website-generation',
  deployment: 'wordpress-deployment',
  media: 'media-processing',
};

function deploymentPayload() {
  return JSON.stringify({
    id: '123e4567-e89b-42d3-a456-426614174001',
    type: 'deployment',
    resource_id: '123e4567-e89b-42d3-a456-426614174000',
    attempt: 1,
    created_at: '2026-08-01T00:00:00Z',
    idempotency_key: 'deployment:123e4567-e89b-42d3-a456-426614174000:1',
  });
}

function fakeRedis(payload) {
  const calls = { lpush: [], lrem: 0 };
  return {
    calls,
    brpoplpush: async () => payload,
    set: async () => 'OK',
    del: async () => 1,
    get: async () => 'worker-1',
    lpush: async (...args) => {
      calls.lpush.push(args);
    },
    lrem: async () => {
      calls.lrem += 1;
    },
  };
}

test('409 conflict is acknowledged exactly once and does not grow queue depth', async () => {
  const redis = fakeRedis(deploymentPayload());
  let processed = 0;
  await consumeOne(redis, config, config.deployment, 'worker-1', async () => {
    processed += 1;
    throw new DeploymentConflictError('already claimed', {
      kind: 'deployments',
      id: '123e4567-e89b-42d3-a456-426614174000',
      action: 'started',
      status: 409,
      code: 'deployment_already_claimed',
    });
  });
  assert.equal(processed, 1);
  assert.equal(redis.calls.lpush.length, 0);
  assert.equal(redis.calls.lrem, 1);
});

test('404 and 422 permanent failures are acknowledged without requeue', async () => {
  for (const status of [404, 422]) {
    const redis = fakeRedis(deploymentPayload());
    await consumeOne(redis, config, config.deployment, 'worker-1', async () => {
      throw new PermanentApiError('permanent', {
        kind: 'deployments',
        id: '123e4567-e89b-42d3-a456-426614174000',
        action: 'started',
        status,
        code: 'internal_api_error',
      });
    });
    assert.equal(redis.calls.lpush.length, 0);
    assert.equal(redis.calls.lrem, 1);
  }
});

test('500 failure is requeued once', async () => {
  const redis = fakeRedis(deploymentPayload());
  await consumeOne(redis, config, config.deployment, 'worker-1', async () => {
    throw new RetryableApiError('transient', {
      kind: 'deployments',
      id: '123e4567-e89b-42d3-a456-426614174000',
      action: 'started',
      status: 500,
      code: 'internal_api_error',
    });
  });
  assert.equal(redis.calls.lpush.length, 1);
  assert.equal(redis.calls.lrem, 1);
});

test('uses capped exponential retry backoff', () => {
  assert.equal(retryDelayMs(1), 1_000);
  assert.equal(retryDelayMs(2), 2_000);
  assert.equal(retryDelayMs(10), 30_000);
});
