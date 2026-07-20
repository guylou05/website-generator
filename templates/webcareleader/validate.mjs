import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  pageSchema,
  sectionSchema,
  siteBlueprintSchema,
} from '../../packages/shared/dist/schema/index.js';

const root = fileURLToPath(new URL('.', import.meta.url));
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const website = siteBlueprintSchema.parse(
  await readJson(join(root, 'website.json')),
);
const pageFiles = (await readdir(join(root, 'pages')))
  .filter((file) => file.endsWith('.json'))
  .sort();
const sectionFiles = (await readdir(join(root, 'sections')))
  .filter((file) => file.endsWith('.json'))
  .sort();
const pages = await Promise.all(
  pageFiles.map(async (file) =>
    pageSchema.parse(await readJson(join(root, 'pages', file))),
  ),
);
await Promise.all(
  sectionFiles.map(async (file) =>
    sectionSchema.parse(await readJson(join(root, 'sections', file))),
  ),
);
assert.equal(pages.length, website.pages.length);
for (const page of pages)
  assert.deepEqual(
    page,
    website.pages.find((candidate) => candidate.id === page.id),
  );
console.info(
  `Validated WebcareLeader: ${pages.length} pages and ${sectionFiles.length} reusable sections.`,
);
