import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { SECTION_TYPES } from '@website-generator/shared/schema';
import {
  ELEMENTOR_GENERIC_SECTION_TYPES,
  ELEMENTOR_SECTION_COMPATIBILITY,
  renderElementorPage,
  renderValidatedElementorPage,
  UnsupportedElementorSectionError,
} from '../../../dist/elementor/index.js';

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

test('invalid input returns a descriptive error', () => {
  assert.throws(
    () => renderElementorPage({}, 'home'),
    /Website Blueprint validation failed/,
  );
});

function renderSingleSection(type, id = `${type}-section`) {
  const input = structuredClone(blueprint);
  input.pages[0].sections = [
    {
      id,
      type,
      label: 'Generic section',
      layout: {
        container: 'wide',
        columns: 2,
        spacing: 'large',
        background: 'surface',
      },
      components: [
        { id: 'first', type: 'heading', level: 2, text: 'First' },
        { id: 'second', type: 'text', text: 'Second' },
        {
          id: 'third',
          type: 'button',
          label: 'Third',
          href: '/third',
          intent: 'primary',
          external: false,
        },
      ],
    },
  ];
  return renderElementorPage(input, 'page-home', {
    includeHeader: false,
    includeFooter: false,
  }).content[0];
}

test('content renders its components in source order using its layout', () => {
  const section = renderSingleSection('content');
  assert.equal(section.settings.website_generator_section, 'content');
  assert.equal(section.settings.content_width, 'boxed');
  assert.equal(section.settings.flex_direction, 'row');
  assert.deepEqual(
    section.elements.map((element) => element.widgetType),
    ['heading', 'text-editor', 'button'],
  );
});

test('why_choose_us content does not depend on ID inference', () => {
  const section = renderSingleSection('content', 'why_choose_us');
  assert.equal(section.settings.website_generator_source_id, 'why_choose_us');
  assert.equal(section.elements.length, 3);
});

test('custom sections use the generic component renderer', () => {
  const section = renderSingleSection('custom', 'bespoke-custom');
  assert.equal(section.settings.website_generator_section, 'custom');
  assert.deepEqual(
    section.elements.map((element) => element.widgetType),
    ['heading', 'text-editor', 'button'],
  );
});

test('specialized section types retain specialized rendering', () => {
  const section = renderSingleSection('testimonials');
  assert.equal(section.settings.website_generator_section, 'testimonials');
  assert.equal(section.elements[1].elType, 'container');
  assert.equal(section.elements[1].elements[0].widgetType, 'icon-box');
});

test('unknown section types throw with rendering diagnostics', () => {
  const unsupported = structuredClone(blueprint);
  unsupported.pages[0].sections = [
    {
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
    },
  ];
  unsupported.pages[0].sections[0].type = 'future-section';
  assert.throws(
    () => renderValidatedElementorPage(unsupported, 'page-home'),
    (error) => {
      assert.ok(error instanceof UnsupportedElementorSectionError);
      assert.match(error.message, /page ID "page-home"/);
      assert.match(error.message, /section ID "unsupported-content"/);
      assert.match(error.message, /section type "future-section"/);
      assert.match(error.message, /component count 1/);
      return true;
    },
  );
});

test('every canonical section type has explicit Elementor coverage', () => {
  assert.deepEqual(Object.keys(ELEMENTOR_SECTION_COMPATIBILITY), [
    ...SECTION_TYPES,
  ]);
  for (const type of SECTION_TYPES) {
    const rendering = ELEMENTOR_SECTION_COMPATIBILITY[type];
    assert.ok(rendering === 'specialized' || rendering === 'generic');
    assert.equal(
      ELEMENTOR_GENERIC_SECTION_TYPES.includes(type),
      rendering === 'generic',
    );
  }
});
