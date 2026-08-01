import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';
import {
  OpenAIBusinessAnalyzer,
  OpenAIContentWriter,
  OpenAIWebsitePlanner,
  OpenAIProviderError,
  OpenAIBlueprintGenerator,
  BlueprintTransportValidationError,
  OpenAIRetryPolicy,
  OpenAIStructuredClient,
  readOpenAIConfig,
  openAISchemas,
  openAIWebsiteBlueprintSchema,
  siteBlueprintSchema,
  findSchemaFormats,
  findSchemaRefs,
  prepareOpenAISchema,
  validateOpenAISchema,
} from '../dist/providers/openai/index.js';
import {
  normalizeBlueprint,
  slugifyPage,
  truncateSeo,
} from '../../shared/dist/schema/index.js';

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

test('blueprint and repair runtime schemas contain only standalone $ref nodes', () => {
  for (const name of ['website_blueprint', 'website_blueprint_repair']) {
    const schema = zodResponseFormat(openAIWebsiteBlueprintSchema, name)
      .json_schema.schema;
    assert.doesNotThrow(() =>
      validateOpenAISchema(name, openAIWebsiteBlueprintSchema),
    );
    const defaults = [];
    const findDefaults = (node, path = '#') => {
      if (!node || typeof node !== 'object') return;
      if (!Array.isArray(node) && Object.hasOwn(node, 'default'))
        defaults.push(path);
      for (const [key, child] of Object.entries(node))
        findDefaults(child, `${path}/${key}`);
    };
    findDefaults(schema);
    assert.deepEqual(defaults, [], name);
    const refs = findSchemaRefs(schema);
    assert.ok(refs.length > 0, `${name} should exercise recursive $ref output`);
    for (const { path, node } of refs)
      assert.deepEqual(Object.keys(node), ['$ref'], `${name}: ${path}`);
  }
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

test('website_copy normalizes duplicate page and section keys without losing content', () => {
  const section = {
    key: 'hero',
    heading: null,
    body: null,
    items: null,
    callToAction: null,
  };
  const parsed = openAISchemas.website_copy.parse({
    pages: [
      { key: 'home', sections: [section, section, section] },
      { key: 'home', sections: [] },
    ],
  });
  assert.deepEqual(
    parsed.pages.map(({ key }) => key),
    ['home', 'home-2'],
  );
  assert.deepEqual(
    parsed.pages[0].sections.map(({ key }) => key),
    ['hero', 'hero-2', 'hero-3'],
  );
});

test('blueprint transport parses directly into the canonical domain schema', () => {
  const canonicalInput = JSON.parse(
    readFileSync(
      new URL('../../shared/sample-blueprint.json', import.meta.url),
    ),
  );
  const canonical = siteBlueprintSchema.parse(canonicalInput);
  const jsonSchema = zodResponseFormat(
    openAIWebsiteBlueprintSchema,
    'website_blueprint',
  ).json_schema.schema;
  const resolve = (schema) => {
    if (!schema.$ref) return schema;
    return schema.$ref
      .slice(2)
      .split('/')
      .reduce((node, key) => node[key], jsonSchema);
  };
  const toTransport = (value, rawSchema) => {
    const schema = resolve(rawSchema);
    if (value === undefined && schema.nullable) return null;
    if (value === undefined && schema.type === 'null') return null;
    if (schema.anyOf) {
      const match = schema.anyOf.find((choice) => {
        const candidate = resolve(choice);
        if (value && typeof value === 'object' && !Array.isArray(value))
          return (
            candidate.properties?.type &&
            resolve(candidate.properties.type).const === value.type
          );
        if (Array.isArray(value)) return candidate.type === 'array';
        if (value === undefined) return candidate.type === 'null';
        return candidate.type === typeof value;
      });
      return toTransport(value, match ?? schema.anyOf[0]);
    }
    if (Array.isArray(value))
      return value.map((item) => toTransport(item, schema.items));
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(schema.properties).map(([key, child]) => [
          key,
          toTransport(value[key], child),
        ]),
      );
    }
    return value;
  };
  const transported = openAIWebsiteBlueprintSchema.parse(
    toTransport(canonical, jsonSchema),
  );
  const domain = siteBlueprintSchema.parse(transported);
  assert.equal(domain.defaultSeo.noIndex, false);
  assert.equal(domain.pages[0].sections[0].layout.container, 'wide');
  assert.equal(domain.pages[0].sections[0].components[2].external, false);
});

test('blueprint normalization deterministically cleans URLs, nullable strings, slugs, and SEO', () => {
  const value = JSON.parse(
    readFileSync(
      new URL('../../shared/sample-blueprint.json', import.meta.url),
    ),
  );
  value.defaultSeo.canonicalUrl = ' N/A ';
  value.defaultSeo.openGraph = {
    title: '',
    description: ' ',
    imageUrl: ' https://example.com/card.jpg ',
    imageAlt: '',
    type: 'website',
  };
  value.defaultSeo.title = `${'A useful website title '.repeat(5)}!!!`;
  value.pages.push(structuredClone(value.pages[0]));
  value.pages[0].slug = '/DNS_Fixes/';
  const duplicate = value.pages.at(-1);
  duplicate.id = 'duplicate-page';
  duplicate.slug = 'https://example.com/DNS_Fixes/?source=test#top';
  const component = value.pages[0].sections[0].components[0];
  component.accessibilityLabel = ' ';
  component.style = { variant: '', align: null, width: null };

  const normalized = normalizeBlueprint(value).value;
  assert.equal(normalized.defaultSeo.canonicalUrl, null);
  assert.equal(
    normalized.defaultSeo.openGraph.imageUrl,
    'https://example.com/card.jpg',
  );
  assert.equal(normalized.defaultSeo.openGraph.imageAlt, null);
  assert.ok(normalized.defaultSeo.title.length <= 70);
  assert.equal(normalized.pages[0].slug, 'dns-fixes');
  assert.equal(normalized.pages.at(-1).slug, 'dns-fixes-2');
  assert.equal(component.text.length > 0, true);
  assert.equal(
    normalized.pages[0].sections[0].components[0].accessibilityLabel,
    null,
  );
  assert.equal(
    normalized.pages[0].sections[0].components[0].style.variant,
    null,
  );
  assert.equal(siteBlueprintSchema.safeParse(normalized).success, true);
});

test('slug and SEO helpers preserve homepage semantics and truncate on words', () => {
  assert.equal(slugifyPage('Website Fix'), 'website-fix');
  assert.equal(slugifyPage('https://example.com/email-help?q=1'), 'email-help');
  assert.equal(slugifyPage('/'), '');
  assert.equal(truncateSeo('one two three four', 13), 'one two three');
});

test('blueprint generation makes exactly one targeted repair for required content', async () => {
  const invalid = JSON.parse(
    readFileSync(
      new URL('../../shared/sample-blueprint.json', import.meta.url),
    ),
  );
  invalid.pages[0].sections[0].components[1].text = '';
  invalid.defaultSeo.canonicalUrl = 'TBD';
  let repairInput;
  const client = {
    usage: [],
    calls: [],
    async generate(name, _prompt, input) {
      this.calls.push(name);
      if (name === 'website_blueprint') return invalid;
      repairInput = input;
      const repaired = structuredClone(input.normalizedBlueprint);
      repaired.pages[0].sections[0].components[1].text = 'Repaired copy';
      return repaired;
    },
  };
  const result = await new OpenAIBlueprintGenerator(client).generate(
    {},
    { runId: 'test' },
  );
  assert.deepEqual(client.calls, [
    'website_blueprint',
    'website_blueprint_repair',
  ]);
  assert.equal(repairInput.normalizedBlueprint.defaultSeo.canonicalUrl, null);
  assert.deepEqual(repairInput.issues[0].path, [
    'pages',
    0,
    'sections',
    0,
    'components',
    1,
    'text',
  ]);
  assert.equal(siteBlueprintSchema.safeParse(result).success, true);
});

test('local transport Zod failures retain blueprint classification', async () => {
  const client = {
    usage: [],
    async generate() {
      throw new z.ZodError([]);
    },
  };
  await assert.rejects(
    new OpenAIBlueprintGenerator(client).generate({}, { runId: 'test' }),
    (error) =>
      error instanceof BlueprintTransportValidationError &&
      !(error instanceof OpenAIProviderError),
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
