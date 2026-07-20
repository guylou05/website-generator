import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { renderElementorPage } from '../../../packages/renderer/dist/elementor/index.js';

const blueprintUrl = new URL('../website.json', import.meta.url);
const outputUrl = new URL('./home.elementor.json', import.meta.url);
const blueprint = JSON.parse(await readFile(blueprintUrl, 'utf8'));
const document = renderElementorPage(blueprint, 'page-home');
await writeFile(
  fileURLToPath(outputUrl),
  `${JSON.stringify(document, null, 2)}\n`,
);
console.info(`Generated ${fileURLToPath(outputUrl)}`);
