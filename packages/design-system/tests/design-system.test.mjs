import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createColorTokens,
  createWebcareLeaderTheme,
  defaultColors,
  sectionVariants,
} from '../dist/index.js';

test('brand color overrides do not mutate defaults or unrelated tokens', () => {
  const colors = createColorTokens({
    light: { primary: '#112233', border: '#445566' },
    dark: { accent: '#778899' },
  });
  assert.equal(colors.light.primary, '#112233');
  assert.equal(colors.light.border, '#445566');
  assert.equal(colors.light.secondary, defaultColors.light.secondary);
  assert.equal(colors.dark.accent, '#778899');
  assert.equal(defaultColors.light.primary, '#1D4ED8');
});

test('WebcareLeader preserves its defaults while accepting brand overrides', () => {
  const customized = createWebcareLeaderTheme({
    light: { primary: '#123456' },
  });
  assert.equal(customized.tokens.colors.light.primary, '#123456');
  assert.equal(customized.tokens.colors.light.secondary, '#0E7490');
  assert.match(customized.tokens.typography.fontFamily.body, /^Inter/);
  assert.equal(customized.defaultSectionVariants.hero, 'clean');
});

test('every section variant describes the complete renderer-neutral contract', () => {
  const requiredKinds = [
    'header',
    'hero',
    'services',
    'features',
    'pricing',
    'testimonials',
    'faq',
    'contact',
    'cta',
    'footer',
  ];
  assert.deepEqual(Object.keys(sectionVariants), requiredKinds);
  for (const [kind, variant] of Object.entries(sectionVariants)) {
    assert.equal(variant.kind, kind);
    assert.ok(variant.layouts.includes(variant.defaultLayout));
    assert.ok(variant.alignment.length > 0);
    assert.ok(variant.contentLimits.maxHeadingCharacters > 0);
    assert.ok(variant.supportedMedia.length > 0);
    assert.ok(variant.responsive.columns);
    assert.ok(
      variant.styleOptions.choices.includes(variant.styleOptions.defaultChoice),
    );
  }
});
