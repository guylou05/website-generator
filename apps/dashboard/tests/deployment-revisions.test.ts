import assert from 'node:assert/strict';
import test from 'node:test';
import { DashboardApiClient, type WebsiteRevision } from '../src/lib/api-client';
import { deploymentRevisionState } from '../src/lib/deployment-revisions';

const revision = (id: string, revisionNumber: number): WebsiteRevision => ({
  id,
  revisionNumber,
  status: 'ready',
  createdAt: '2026-08-02T00:00:00Z',
});

test('one revision is automatically selected without showing a selector', () => {
  assert.deepEqual(deploymentRevisionState([revision('only', 1)]), {
    selectedRevisionId: 'only',
    showSelector: false,
    canCreatePlan: true,
  });
});

test('multiple revisions show a selector and initially select the newest', () => {
  assert.deepEqual(
    deploymentRevisionState([revision('older', 2), revision('newest', 3)]),
    {
      selectedRevisionId: 'newest',
      showSelector: true,
      canCreatePlan: true,
    },
  );
});

test('zero revisions leave plan creation disabled', () => {
  assert.deepEqual(deploymentRevisionState([]), {
    selectedRevisionId: undefined,
    showSelector: false,
    canCreatePlan: false,
  });
});

test('deployment plan request includes the selected revision ID', async () => {
  let requestBody = '';
  const client = new DashboardApiClient('http://api.test/api', async (input, init) => {
    if (String(input).endsWith('/sanctum/csrf-cookie'))
      return new Response(null, { status: 204 });
    requestBody = String(init?.body);
    return Response.json({ data: { id: 'plan', status: 'ready_for_review' } });
  });

  await client.createDeploymentPlan('project', 'connection', 'revision-3');

  assert.deepEqual(JSON.parse(requestBody), {
    wordpress_connection_id: 'connection',
    website_revision_id: 'revision-3',
  });
});
