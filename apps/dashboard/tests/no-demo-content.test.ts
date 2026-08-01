import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const forbidden = [
  'Welcome back, Alex',
  'Alex Morgan',
  'alex@example.com',
  'Northstar Studio',
  'Northstar Health',
  'Kanso Interiors',
  'Atlas Finance',
  'Flora Studio',
  '24.8K',
  '4m 18s',
  '92%',
];
async function files(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) =>
        entry.isDirectory()
          ? files(path.join(directory, entry.name))
          : [path.join(directory, entry.name)],
      ),
    )
  ).flat();
}
test('production dashboard source contains no known demo entities or metrics', async () => {
  const source = (await files(path.resolve('src'))).filter((file) =>
    /\.(ts|tsx)$/.test(file),
  );
  for (const file of source) {
    const contents = await readFile(file, 'utf8');
    for (const value of forbidden)
      assert.equal(
        contents.includes(value),
        false,
        `${value} remains in ${file}`,
      );
  }
});
