import assert from 'node:assert/strict';
import test from 'node:test';
import { redact } from '../dist/logger.js';
test('redacts nested worker secrets without changing safe context', () =>
  assert.deepEqual(
    redact({
      authorization: 'Bearer secret',
      nested: { applicationPassword: 'secret', jobId: '1' },
    }),
    {
      authorization: '[REDACTED]',
      nested: { applicationPassword: '[REDACTED]', jobId: '1' },
    },
  ));
