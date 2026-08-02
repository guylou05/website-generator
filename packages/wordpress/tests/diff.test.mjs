import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createDeploymentPlan } from '../dist/index.js';

const blueprint = JSON.parse(
  await readFile(
    new URL('../../shared/sample-blueprint.json', import.meta.url),
  ),
);
const snapshot = {
  capturedAt: '2026-08-02T00:00:00Z',
  pages: [],
  media: [],
  menus: [],
  homepage: { showOnFront: 'posts', pageId: 0 },
  settings: {},
  elementor: { active: true, cssCachePresent: false },
};

test('creates a comprehensive, immutable dry-run plan without a WordPress client', () => {
  const plan = createDeploymentPlan({
    blueprint,
    snapshot,
    elementorPages: { [blueprint.pages[0].id]: [{ id: 'hero' }] },
    setHomepage: true,
  });
  assert.equal(plan.readOnly, true);
  assert.equal(plan.safetyStatus, 'safe');
  assert.ok(
    plan.changes.some(
      (change) => change.resource === 'page' && change.action === 'create',
    ),
  );
  assert.ok(plan.changes.some((change) => change.resource === 'elementor'));
  assert.ok(plan.changes.some((change) => change.resource === 'seo'));
  assert.ok(plan.changes.some((change) => change.resource === 'menu'));
  assert.ok(plan.changes.some((change) => change.resource === 'homepage'));
  assert.ok(plan.changes.some((change) => change.resource === 'css'));
  assert.equal(plan.statistics.total, plan.changes.length);
  assert.ok(plan.estimatedSeconds > 0);
});

test('blocks a plan when Elementor changes cannot be applied safely', () => {
  const plan = createDeploymentPlan({
    blueprint,
    snapshot: {
      ...snapshot,
      elementor: { active: false, cssCachePresent: false },
    },
    elementorPages: { [blueprint.pages[0].id]: [] },
  });
  assert.equal(plan.safetyStatus, 'blocked');
  assert.ok(plan.warnings.some((warning) => warning.includes('Elementor')));
});
