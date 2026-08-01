import assert from 'node:assert/strict';
import test from 'node:test';
import { serializeException } from '../dist/handlers.js';
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

test('serializes complete exception diagnostics without replacing the error', () => {
  const cause = new Error('database rejected blueprint');
  cause.name = 'QueryError';
  const error = new Error('completion failed', { cause });
  Object.assign(error, {
    sql: 'insert into generation_runs',
    errors: ['invalid'],
  });

  const details = serializeException(error);
  assert.equal(details.name, 'Error');
  assert.equal(details.message, 'completion failed');
  assert.match(details.stack, /completion failed/);
  assert.equal(details.sql, 'insert into generation_runs');
  assert.deepEqual(details.errors, ['invalid']);
  assert.equal(details.cause.name, 'QueryError');
  assert.equal(details.cause.message, 'database rejected blueprint');
});
