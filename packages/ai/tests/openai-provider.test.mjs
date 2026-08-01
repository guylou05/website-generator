import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'zod';
import {
  OpenAIBusinessAnalyzer,
  OpenAIContentWriter,
  OpenAIWebsitePlanner,
  OpenAIProviderError,
  OpenAIRetryPolicy,
  OpenAIStructuredClient,
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

test('provider preserves OpenAI API error fields and request id', async () => {
  const sdk = {
    chat: {
      completions: {
        parse: async () => {
          throw {
            status: 400,
            error: {
              type: 'invalid_request_error',
              code: 'unsupported_parameter',
              message: 'response_format is not supported',
            },
            headers: { get: () => 'req_123' },
          };
        },
      },
    },
  };
  const client = new OpenAIStructuredClient(
    { apiKey: 'test', model: 'gpt-5.5', timeoutMs: 1000, maxRetries: 2 },
    sdk,
  );

  await assert.rejects(
    client.generate('test', 'prompt', {}, z.object({ result: z.string() })),
    (error) => {
      assert(error instanceof OpenAIProviderError);
      assert.equal(error.message, 'response_format is not supported');
      assert.deepEqual(error.details, {
        provider: 'openai',
        model: 'gpt-5.5',
        status: 400,
        type: 'invalid_request_error',
        code: 'unsupported_parameter',
        message: 'response_format is not supported',
        requestId: 'req_123',
        endpoint: '/v1/chat/completions',
      });
      return true;
    },
  );
});

test('OpenAI retry policy retries only approved transient statuses', () => {
  const policy = new OpenAIRetryPolicy(2);
  const error = (status, type = 'server_error') =>
    new OpenAIProviderError(
      {
        provider: 'openai',
        model: 'model',
        status,
        type,
        message: 'failure',
        endpoint: '/v1/chat/completions',
      },
      new Error('failure'),
    );
  assert.equal(policy.maxAttempts, 3);
  for (const status of [429, 500, 502, 503, 504])
    assert.equal(policy.shouldRetry(error(status)), true);
  for (const status of [400, 401, 403, 408, 409])
    assert.equal(policy.shouldRetry(error(status)), false);
  assert.equal(policy.shouldRetry(error(500, 'invalid_request_error')), false);
  assert.equal(policy.shouldRetry(error(500, 'authentication_error')), false);
  assert.equal(policy.shouldRetry(new Error('network failure')), false);
});
