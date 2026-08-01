import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';
import {
  OpenAIBusinessAnalyzer,
  OpenAIContentWriter,
  OpenAIWebsitePlanner,
  OpenAIProviderError,
  OpenAIRetryPolicy,
  OpenAIStructuredClient,
  readOpenAIConfig,
  openAISchemas,
  openAIWebsiteBlueprintSchema,
  findSchemaFormats,
  prepareOpenAISchema,
  validateOpenAISchema,
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
        offerings: input.productsOrServices.map((offering) => ({
          ...offering,
          audience: null,
        })),
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
    return schema.parse({ pages: [] });
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

test('every OpenAI stage schema is strict and fully required', () => {
  for (const [name, schema] of Object.entries(openAISchemas))
    assert.doesNotThrow(() => validateOpenAISchema(name, schema), name);

  const analysis = validateOpenAISchema(
    'business_analysis',
    openAISchemas.business_analysis,
  );
  const audience = analysis.properties.offerings.items.properties.audience;
  assert.equal(audience.nullable, true);
  assert.ok(analysis.properties.offerings.items.required.includes('audience'));
});
test('website_copy exact OpenAI JSON schema uses only strict keyed arrays', () => {
  const schema = zodResponseFormat(openAISchemas.website_copy, 'website_copy')
    .json_schema.schema;
  const pages = schema.properties.pages;
  assert.equal(pages.type, 'array');
  assert.equal(pages.items.type, 'object');
  assert.equal('additionalProperties' in pages, false);

  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'object') {
      assert.equal(node.additionalProperties, false);
      assert.deepEqual(
        node.required.toSorted(),
        Object.keys(node.properties).toSorted(),
      );
    }
    for (const child of Object.values(node.properties ?? {})) visit(child);
    visit(node.items);
    for (const keyword of ['anyOf', 'oneOf', 'allOf'])
      for (const child of node[keyword] ?? []) visit(child);
  };
  visit(schema);
});

test('website_blueprint exact submitted schema has no formats or record maps', () => {
  const responseFormat = zodResponseFormat(
    openAIWebsiteBlueprintSchema,
    'website_blueprint',
  );
  const submittedSchema = prepareOpenAISchema(
    responseFormat.json_schema.schema,
  );

  assert.deepEqual(findSchemaFormats(submittedSchema), []);
  const serialized = JSON.stringify(submittedSchema);
  assert.equal(serialized.includes('uri'), false);

  const visit = (node, path = '#') => {
    if (!node || typeof node !== 'object') return;
    assert.equal('format' in node, false, path);
    if (node.type === 'object') {
      assert.ok(node.properties, `${path} must not be a record map`);
      assert.equal(node.additionalProperties, false, path);
      assert.deepEqual(
        node.required.toSorted(),
        Object.keys(node.properties).toSorted(),
        path,
      );
    }
    for (const [key, child] of Object.entries(node.properties ?? {}))
      visit(child, `${path}/properties/${key}`);
    visit(node.items, `${path}/items`);
    for (const keyword of ['anyOf', 'oneOf', 'allOf'])
      for (const [index, child] of (node[keyword] ?? []).entries())
        visit(child, `${path}/${keyword}/${index}`);
    for (const keyword of ['definitions', '$defs'])
      for (const [key, child] of Object.entries(node[keyword] ?? {}))
        visit(child, `${path}/${keyword}/${key}`);
  };
  visit(submittedSchema);
  assert.doesNotThrow(() =>
    validateOpenAISchema('website_blueprint', openAIWebsiteBlueprintSchema),
  );
});

test('schema format reporter includes the response name, path, and value', () => {
  const schema = z.object({ canonicalUrl: z.string().url() });
  assert.deepEqual(
    findSchemaFormats(zodResponseFormat(schema, 'example').json_schema.schema),
    [{ path: '#/properties/canonicalUrl', value: 'uri' }],
  );
});

test('website_copy stage converts an actual structured client response to domain records', async () => {
  const sdk = {
    chat: {
      completions: {
        parse: async () => ({
          choices: [
            {
              message: {
                parsed: {
                  pages: [
                    {
                      key: 'home',
                      sections: [
                        {
                          key: 'hero',
                          heading: 'Websites repaired',
                          body: null,
                          items: null,
                          callToAction: {
                            label: 'Get help',
                            destination: '/contact',
                          },
                        },
                      ],
                    },
                  ],
                },
              },
            },
          ],
        }),
      },
    },
  };
  const client = new OpenAIStructuredClient(
    { apiKey: 'test', model: 'gpt-5.5', timeoutMs: 1000, maxRetries: 0 },
    sdk,
  );
  const result = await new OpenAIContentWriter(client).write(
    { analysis: {}, plan: {} },
    { runId: 'test' },
  );
  assert.deepEqual(result, {
    pages: {
      home: {
        sections: {
          hero: {
            heading: 'Websites repaired',
            callToAction: { label: 'Get help', destination: '/contact' },
          },
        },
      },
    },
  });
});

test('website_copy rejects duplicate page and section keys clearly', () => {
  const section = {
    key: 'hero',
    heading: null,
    body: null,
    items: null,
    callToAction: null,
  };
  assert.throws(
    () =>
      openAISchemas.website_copy.parse({
        pages: [
          { key: 'home', sections: [section, section] },
          { key: 'home', sections: [] },
        ],
      }),
    /Duplicate (page|section) key/,
  );
});
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
