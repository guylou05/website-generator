import assert from 'node:assert/strict';
import test from 'node:test';
import { DashboardApiClient, mapProject } from '../src/lib/api-client';

test('maps Laravel snake_case resources to dashboard types', () => {
  const project = mapProject({
    id: 'uuid',
    name: 'Acme',
    slug: 'acme',
    status: 'ready',
    project_id: '',
    provider: 'mock',
    current_stage: null,
    progress: 0,
    input: {},
    output: null,
    error: null,
    events: [],
    stage: '',
    event_type: '',
    message: null,
    metadata: null,
    business_profile: { industry: 'Tech' },
    brand_settings: null,
    created_at: '2026-01-01',
    updated_at: '2026-01-02',
    generation_runs: [
      {
        id: 'run',
        name: '',
        slug: '',
        business_profile: {},
        brand_settings: null,
        generation_runs: [],
        stage: '',
        event_type: '',
        message: null,
        metadata: null,
        updated_at: '2026-01-01',
        project_id: 'uuid',
        provider: 'mock',
        status: 'completed',
        current_stage: null,
        progress: 100,
        input: {},
        output: null,
        error: null,
        events: [],
        created_at: '2026-01-01',
      },
    ],
  });
  assert.equal(project.businessProfile.industry, 'Tech');
  assert.equal(project.generationRuns[0]?.projectId, 'uuid');
});

test('client creates a generation and maps its response', async () => {
  const fakeFetch: typeof fetch = async () =>
    new Response(
      JSON.stringify({
        data: {
          id: 'run',
          project_id: 'project',
          provider: 'mock',
          status: 'completed',
          current_stage: null,
          progress: 100,
          input: {},
          output: {},
          error: null,
          events: [],
          created_at: '2026-01-01',
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  const run = await new DashboardApiClient(
    'http://api.test',
    fakeFetch,
  ).createGeneration('project', {});
  assert.equal(run.status, 'completed');
});
