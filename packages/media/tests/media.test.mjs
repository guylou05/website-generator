import test from 'node:test';
import assert from 'node:assert/strict';
import {
  transformationHash,
  normalizeMediaReference,
  selectResponsiveVariant,
  assertControlledDownloadUrl,
  redactMediaSecrets,
} from '../dist/index.js';
test('transformation hashes are deterministic', () =>
  assert.equal(
    transformationHash('a', { quality: 80, resize: { width: 2 } }),
    transformationHash('a', { resize: { width: 2 }, quality: 80 }),
  ));
test('normalizes stable and legacy media references', () => {
  assert.equal(
    normalizeMediaReference('https://legacy.test/a.jpg'),
    'https://legacy.test/a.jpg',
  );
  assert.deepEqual(
    normalizeMediaReference({ assetId: 'a', focalPoint: { x: 0.5, y: 0.2 } }),
    { assetId: 'a', decorative: false, focalPoint: { x: 0.5, y: 0.2 } },
  );
});
test('does not upscale variant selection beyond best available', () =>
  assert.equal(
    selectResponsiveVariant(
      [
        { width: 320, url: 'a' },
        { width: 640, url: 'b' },
      ],
      1000,
    )?.url,
    'b',
  ));
test('controlled downloads reject arbitrary hosts', () =>
  assert.throws(() =>
    assertControlledDownloadUrl('http://127.0.0.1/a', ['cdn.test']),
  ));
test('redacts signed values', () =>
  assert.doesNotMatch(redactMediaSecrets('x?token=secret'), /secret/));
