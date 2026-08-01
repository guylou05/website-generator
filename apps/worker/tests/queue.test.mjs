import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeJob, queueKey } from '../dist/queue.js';

test('decodes the language-neutral Laravel envelope', () => {
  const payload = JSON.stringify({
    version: 1,
    type: 'generation',
    uuid: '123e4567-e89b-42d3-a456-426614174000',
    attempt: 1,
    enqueued_at: '2026-08-01T00:00:00Z',
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
      },
      'website-generation',
    ),
    'sitefoundry:queue:website-generation',
  );
});
