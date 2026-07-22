import assert from 'node:assert/strict';
import test from 'node:test';
import {
  configureWebsiteGenerator,
  generateWebsite,
  MockAiProvider,
  PipelineStageError,
  StageTimeoutError,
  WebsiteGenerationOrchestrator,
} from '../dist/orchestrator/index.js';

const profile = {
  businessName: 'Acme',
  description: 'Test',
  industry: 'Services',
  targetAudiences: ['teams'],
  productsOrServices: [],
  differentiators: [],
  goals: [],
};
const responses = {
  analysis: {
    summary: 'Acme',
    industry: 'Services',
    audiences: [],
    offerings: [],
    valueProposition: 'Reliable',
    goals: [],
    recommendedTone: [],
    constraints: [],
  },
  plan: {
    strategy: 'Convert',
    primaryGoal: 'Contact',
    navigation: [],
    pages: [],
  },
  content: { pages: {} },
  seo: { siteTitle: 'Acme', pages: {} },
  design: {
    direction: 'Clean',
    colors: {},
    typography: {},
    globalStyles: {},
    pageLayouts: {},
  },
  blueprint: { schemaVersion: 'test' },
};

function setup(provider = new MockAiProvider(responses), overrides = {}) {
  const events = [];
  const metrics = [];
  const dependencies = {
    projects: {
      async getProfile(id) {
        assert.equal(id, 'project-1');
        return profile;
      },
    },
    analyzer: provider.analyzer,
    planner: provider.planner,
    writer: provider.writer,
    seoGenerator: provider.seoGenerator,
    designer: provider.designer,
    blueprintGenerator: provider.blueprintGenerator,
    reporter: {
      report(event) {
        events.push(event);
      },
    },
    metrics: {
      stageCompleted: (...args) => metrics.push(['completed', ...args]),
      stageFailed: (...args) => metrics.push(['failed', ...args]),
      stageRetried: (...args) => metrics.push(['retried', ...args]),
      generationCompleted: (...args) => metrics.push(['generation', ...args]),
    },
    retryPolicy: { maxAttempts: 2, shouldRetry: () => true, delayMs: () => 0 },
    sleeper: { sleep: async () => {} },
    createRunId: () => 'run-1',
    ...overrides,
  };
  return {
    orchestrator: new WebsiteGenerationOrchestrator(dependencies),
    dependencies,
    events,
    metrics,
    provider,
  };
}

test('runs all stages, reports progress, logs metrics, and returns the blueprint', async () => {
  const { orchestrator, events, metrics, provider } = setup();
  const result = await orchestrator.generateWebsite('project-1');
  assert.equal(result.blueprint, responses.blueprint);
  assert.deepEqual(provider.calls, [
    'analysis',
    'plan',
    'content',
    'seo',
    'design',
    'blueprint',
  ]);
  assert.equal(events.at(-1).type, 'generation.completed');
  assert.equal(events.at(-1).progress.percentage, 100);
  assert.equal(metrics.filter(([name]) => name === 'completed').length, 6);
});

test('retries only the failing stage', async () => {
  const provider = new MockAiProvider(responses).failNext('content');
  const { orchestrator, events, metrics } = setup(provider);
  await orchestrator.generateWebsite('project-1');
  assert.deepEqual(provider.calls, [
    'analysis',
    'plan',
    'content',
    'content',
    'seo',
    'design',
    'blueprint',
  ]);
  assert.equal(
    events.filter(({ type }) => type === 'stage.retrying').length,
    1,
  );
  assert.equal(metrics.filter(([name]) => name === 'retried').length, 1);
});

test('enforces per-stage timeouts and exposes the timeout as the stage cause', async () => {
  const { dependencies } = setup();
  dependencies.analyzer = { analyze: () => new Promise(() => {}) };
  dependencies.stages = {
    analysis: {
      timeoutMs: 5,
      retryPolicy: {
        maxAttempts: 1,
        shouldRetry: () => false,
        delayMs: () => 0,
      },
    },
  };
  await assert.rejects(
    new WebsiteGenerationOrchestrator(dependencies).generateWebsite(
      'project-1',
    ),
    (error) =>
      error instanceof PipelineStageError &&
      error.cause instanceof StageTimeoutError,
  );
});

test('supports the configured generateWebsite(projectId) entry point', async () => {
  const { dependencies } = setup();
  configureWebsiteGenerator(dependencies);
  assert.equal((await generateWebsite('project-1')).projectId, 'project-1');
});
