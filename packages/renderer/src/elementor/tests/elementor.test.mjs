import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { renderElementorPage } from '../../../dist/elementor/index.js';

const repositoryRoot = new URL('../../../../../', import.meta.url);
const blueprint = JSON.parse(
  await readFile(
    new URL('templates/webcareleader/website.json', repositoryRoot),
    'utf8',
  ),
);
const snapshot = JSON.parse(
  await readFile(
    new URL(
      'templates/webcareleader/output/home.elementor.json',
      repositoryRoot,
    ),
    'utf8',
  ),
);

test('WebcareLeader homepage matches the Elementor snapshot', () => {
  assert.deepEqual(renderElementorPage(blueprint, 'page-home'), snapshot);
});

test('Elementor output uses stable unique container and widget IDs', () => {
  const first = renderElementorPage(blueprint, 'page-home');
  const second = renderElementorPage(blueprint, 'page-home');
  assert.deepEqual(first, second);
  const ids = [];
  const visit = (element) => {
    ids.push(element.id);
    element.elements.forEach(visit);
  };
  first.content.forEach(visit);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(first.content.every((element) => element.elType === 'container'));
});

test('invalid input and unsupported sections return descriptive errors', () => {
  assert.throws(
    () => renderElementorPage({}, 'home'),
    /Website Blueprint validation failed/,
  );
  const unsupported = structuredClone(blueprint);
  unsupported.pages[0].sections.push({
    id: 'unsupported-content',
    type: 'content',
    label: 'Unsupported process',
    layout: {
      container: 'standard',
      columns: 1,
      spacing: 'medium',
      background: 'default',
    },
    components: [{ id: 'copy', type: 'text', text: 'Unsupported' }],
  });
  assert.throws(
    () => renderElementorPage(unsupported, 'page-home'),
    /Unsupported Elementor section type "content" at sections\.unsupported-content/,
  );
});
