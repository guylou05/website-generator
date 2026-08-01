import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canCancelGeneration,
  canRetryGeneration,
} from '../src/lib/generation-controls';

test('project detail shows cancellation for every active generation state', () => {
  assert.deepEqual(
    (['queued', 'running', 'cancelling'] as const).map(canCancelGeneration),
    [true, true, true],
  );
  assert.equal(canCancelGeneration('cancelled'), false);
});

test('project detail enables retry only for terminal recoverable states', () => {
  assert.deepEqual(
    (['failed', 'cancelled', 'stale'] as const).map(canRetryGeneration),
    [true, true, true],
  );
  assert.deepEqual(
    (['queued', 'running', 'cancelling', 'succeeded'] as const).map(
      canRetryGeneration,
    ),
    [false, false, false, false],
  );
});
