import assert from 'node:assert/strict';
import test from 'node:test';
import {
  OpenAIBusinessAnalyzer,
  OpenAIContentWriter,
  OpenAIWebsitePlanner,
  readOpenAIConfig,
} from '../dist/providers/openai/index.js';

const fake = {
  usage: [],
  calls: [],
  async generate(name, _prompt, input, schema) {
    this.calls.push(name);
    if (name === 'business_analysis')
      return schema.parse({
        summary: input.description,
        industry: input.industry,
        audiences: [],
        offerings: input.productsOrServices,
        valueProposition: input.description,
        goals: input.goals,
        recommendedTone: ['clear'],
        constraints: [],
      });
    if (name === 'website_plan')
      return schema.parse({
        strategy: 'Convert visitors',
        primaryGoal: 'Leads',
        navigation: [],
        pages: [],
      });
    return schema.parse({ pages: {} });
  },
};
const profile = {
  businessName: 'Acme',
  description: 'Repairs sites',
  industry: 'Web services',
  targetAudiences: ['Local businesses'],
  productsOrServices: [{ name: 'Repair', description: 'Website repair' }],
  differentiators: [],
  goals: ['Leads'],
};
test('stages use an injected client and never call the network', async () => {
  const analysis = await new OpenAIBusinessAnalyzer(fake).analyze(profile, {
    runId: 'test',
  });
  const plan = await new OpenAIWebsitePlanner(fake).plan(analysis, {
    runId: 'test',
  });
  await new OpenAIContentWriter(fake).write(
    { analysis, plan },
    { runId: 'test' },
  );
  assert.deepEqual(fake.calls, [
    'business_analysis',
    'website_plan',
    'website_copy',
  ]);
});
test('configuration reads environment values', () => {
  assert.deepEqual(
    readOpenAIConfig({
      OPENAI_API_KEY: 'secret',
      OPENAI_MODEL: 'model',
      OPENAI_TIMEOUT_MS: '1234',
      OPENAI_MAX_RETRIES: '4',
    }),
    { apiKey: 'secret', model: 'model', timeoutMs: 1234, maxRetries: 4 },
  );
});
test('configuration requires a server API key', () =>
  assert.throws(() => readOpenAIConfig({}), /not configured/));
