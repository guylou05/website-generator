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
  const fakeFetch: typeof fetch = async (input) => {
    if (String(input).endsWith('/sanctum/csrf-cookie'))
      return new Response(null, { status: 204 });

    return new Response(
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
  };
  const run = await new DashboardApiClient(
    'http://api.test',
    fakeFetch,
  ).createGeneration('project', {});
  assert.equal(run.status, 'completed');
});

test('registration initializes Sanctum and sends the decoded XSRF cookie', async () => {
  const originalFetch = globalThis.fetch;
  const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;
  const originalDocument = Object.getOwnPropertyDescriptor(
    globalThis,
    'document',
  );
  const apiUrl = 'https://api.example.com/api';
  const calls: string[] = [];
  process.env.NEXT_PUBLIC_API_URL = apiUrl;
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { cookie: 'theme=dark; XSRF-TOKEN=token%2Bwith%2Fencoding%3D' },
  });
  globalThis.fetch = async function (input, init) {
    assert.equal(this, globalThis);
    calls.push(String(input));
    assert.equal(init?.credentials, 'include');

    if (calls.length === 1) return new Response(null, { status: 204 });

    assert.equal(
      new Headers(init?.headers).get('X-XSRF-TOKEN'),
      'token+with/encoding=',
    );
    assert.equal(
      new Headers(init?.headers).get('Content-Type'),
      'application/json',
    );

    return new Response(
      JSON.stringify({
        data: {
          id: 'user',
          name: 'Test Owner',
          email: 'owner@example.com',
          email_verified_at: null,
          current_organization: null,
          current_role: 'owner',
        },
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } },
    );
  };

  try {
    const user = await new DashboardApiClient().register({
      name: 'Test Owner',
      email: 'owner@example.com',
      password: 'password',
      password_confirmation: 'password',
    });

    assert.equal(user.current_role, 'owner');
    assert.deepEqual(calls, [
      'https://api.example.com/sanctum/csrf-cookie',
      `${apiUrl}/auth/register`,
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalDocument)
      Object.defineProperty(globalThis, 'document', originalDocument);
    else Reflect.deleteProperty(globalThis, 'document');
    if (originalApiUrl === undefined) delete process.env.NEXT_PUBLIC_API_URL;
    else process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
  }
});

test('GET requests preserve caller headers without initializing CSRF', async () => {
  const calls: Array<{ input: string; init: RequestInit | undefined }> = [];
  const fakeFetch: typeof fetch = async (input, init) => {
    calls.push({ input: String(input), init });
    return Response.json({ data: [] });
  };

  const client = new DashboardApiClient(
    'http://api.test/api',
    fakeFetch,
  ) as unknown as {
    call<T>(path: string, init?: RequestInit): Promise<T>;
  };
  await client.call('/projects', {
    method: 'GET',
    headers: { 'X-Caller': 'dashboard' },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.input, 'http://api.test/api/projects');
  assert.equal(
    new Headers(calls[0]?.init?.headers).get('X-Caller'),
    'dashboard',
  );
  assert.equal(calls[0]?.init?.credentials, 'include');
});
