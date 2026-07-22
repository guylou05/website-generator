import assert from 'node:assert/strict';
import test from 'node:test';
import {
  generationReducer,
  initialGenerationState,
  runMockWebsiteGeneration,
  wizardDataToBusinessProfile,
  type GenerationAction,
  type WebsiteWizardData,
} from '../src/lib/website-generation';
const form: WebsiteWizardData = {
  businessName: ' Acme ',
  description: 'Advice',
  businessType: 'Consulting',
  services: ['Strategy'],
  brandColors: ['#123456'],
  targetAudience: 'Founders',
  websiteGoal: 'Leads',
};
test('maps wizard data to a typed business profile', () => {
  const profile = wizardDataToBusinessProfile(form);
  assert.equal(profile.businessName, 'Acme');
  assert.equal(profile.industry, 'Consulting');
  assert.deepEqual(profile.targetAudiences, ['Founders']);
  assert.equal(profile.productsOrServices[0]!.name, 'Strategy');
  assert.equal(profile.brandPreferences?.color1, '#123456');
});
test('handles live progress events', () => {
  let state = generationReducer(initialGenerationState, {
    type: 'start',
    stage: 'analysis',
  });
  state = generationReducer(state, { type: 'complete', stage: 'analysis' });
  assert.deepEqual(state.completedStages, ['analysis']);
  assert.equal(state.percentage, 11);
});
test('reaches success with project output', async () => {
  const actions: GenerationAction[] = [];
  const result = await runMockWebsiteGeneration(
    form,
    (action) => actions.push(action),
    { delayMs: 0 },
  );
  assert.equal(result.pagesGenerated, 4);
  assert.equal(result.blueprintValid, true);
  assert.equal(actions.at(-1)?.type, 'success');
  assert.equal(actions.filter((a) => a.type === 'complete').length, 9);
});
test('records failure and supports retrying from a clean run', async () => {
  let state = initialGenerationState;
  await assert.rejects(
    runMockWebsiteGeneration(
      form,
      (action) => {
        state = generationReducer(state, action);
      },
      { delayMs: 0, failStage: 'elementor' },
    ),
  );
  assert.equal(state.status, 'failed');
  assert.equal(state.failedStage, 'elementor');
  state = initialGenerationState;
  await runMockWebsiteGeneration(
    form,
    (action) => {
      state = generationReducer(state, action);
    },
    { delayMs: 0 },
  );
  assert.equal(state.status, 'success');
  assert.equal(state.percentage, 100);
});
