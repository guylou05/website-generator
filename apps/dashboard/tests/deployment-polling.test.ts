import assert from 'node:assert/strict';
import test from 'node:test';
import { pollDeployment } from '../src/lib/deployment-polling';

const wait = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

test('deployment polling stops when persisted state is terminal', async () => {
  let calls = 0;
  const stop = pollDeployment({
    delay: 1,
    load: async () => {
      calls += 1;
      return { status: 'succeeded' };
    },
    onData: () => undefined,
    onError: (error) => assert.fail(String(error)),
  });
  await wait(15);
  stop();
  assert.equal(calls, 1);
});

test('deployment polling never overlaps and cleanup aborts its request', async () => {
  let active = 0;
  let peak = 0;
  let calls = 0;
  let aborted = false;
  const stop = pollDeployment({
    delay: 1,
    load: async (signal) => {
      calls += 1;
      active += 1;
      peak = Math.max(peak, active);
      signal.addEventListener('abort', () => (aborted = true));
      await wait(4);
      active -= 1;
      return { status: calls > 1 ? 'succeeded' : 'running' };
    },
    onData: () => undefined,
    onError: (error) => assert.fail(String(error)),
  });
  await wait(20);
  stop();
  assert.equal(peak, 1);
  assert.ok(calls >= 2);
  assert.equal(aborted, true);
});
