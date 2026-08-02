'use client';
import Link from 'next/link';
import { useState } from 'react';
import { RevisionViewer } from '@/components/revision-viewer';
import {
  dashboardApi,
  type DeploymentPlan,
  type WordPressConnection,
  type WebsiteRevision,
} from '@/lib/api-client';
import { deploymentRevisionState } from '@/lib/deployment-revisions';

export function DeploymentWorkflow({
  projectId,
  initialConnections,
  revisions,
}: {
  projectId: string;
  runId: string;
  initialConnections: WordPressConnection[];
  revisions: WebsiteRevision[];
}) {
  const revisionState = deploymentRevisionState(revisions);
  const [selectedRevisionId, setSelectedRevisionId] = useState(
    revisionState.selectedRevisionId,
  );
  const [connections, setConnections] = useState(initialConnections);
  const [connection, setConnection] = useState<WordPressConnection | undefined>(
    initialConnections[0],
  );
  const [plan, setPlan] = useState<DeploymentPlan>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const perform = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-6">
      <section className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">WordPress connection</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Select a reusable site saved for your organization.
            </p>
          </div>
          {connections.length > 0 ? (
            <select
              className="rounded-lg border p-2"
              value={connection?.id}
              onChange={(e) =>
                setConnection(connections.find((x) => x.id === e.target.value))
              }
            >
              {connections.map((x) => (
                <option value={x.id} key={x.id}>
                  {x.name || x.siteUrl}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-muted-foreground text-sm">
              No WordPress sites are connected yet.
            </p>
          )}
        </div>
        <div className="mt-5 flex gap-3">
          <Link
            className="rounded-lg border px-4 py-2 text-sm"
            href="/dashboard/settings/wordpress-sites"
          >
            Manage connections
          </Link>
          <Link
            className="text-primary px-4 py-2 text-sm"
            href="/dashboard/settings/wordpress-sites?connect=1"
          >
            Connect another site
          </Link>
        </div>
      </section>
      {connection && (
        <section className="card p-6">
          <div className="flex flex-wrap justify-between gap-4">
            <div>
              <h2 className="font-semibold">
                {connection.name || connection.siteUrl}
              </h2>
              <p className="text-muted-foreground text-sm">
                {connection.siteUrl} ·{' '}
                <span className="capitalize">{connection.status}</span>
              </p>
              <p className="mt-2 text-sm">
                WordPress {connection.wordpressVersion ?? 'not tested'} ·
                Elementor {connection.elementorVersion ?? 'not tested'} ·
                Connector {connection.connectorVersion ?? 'not tested'}
              </p>
            </div>
            <button
              className="rounded-lg border px-4 py-2"
              disabled={busy}
              onClick={() =>
                void perform(async () => {
                  const next = await dashboardApi.verifyConnection(
                    connection.id,
                  );
                  setConnection(next);
                  setConnections((xs) =>
                    xs.map((x) => (x.id === next.id ? next : x)),
                  );
                })
              }
            >
              Test connection
            </button>
          </div>
          {connection.lastError && (
            <p className="mt-3 rounded bg-red-50 p-3 text-sm text-red-700">
              {connection.lastError.message}
            </p>
          )}
        </section>
      )}
      {connection?.status === 'verified' && (
        <section className="card space-y-4 p-6">
          <div>
            <h2 className="text-lg font-semibold">Deployment review</h2>
            <p className="text-muted-foreground text-sm">
              Dry run compares pages, media, menus, homepage, Elementor
              documents, site settings, and SEO without modifying WordPress.
            </p>
          </div>
          <p className="rounded bg-amber-50 p-3 text-sm text-amber-900">
            Read-only analysis: SiteFoundry only sends GET requests and will not
            create, update, or delete WordPress content.
          </p>
          {revisionState.showSelector && (
            <label className="grid gap-2 text-sm font-medium">
              Revision
              <select
                className="rounded-lg border p-2 font-normal"
                value={selectedRevisionId}
                onChange={(event) => setSelectedRevisionId(event.target.value)}
              >
                {revisions.map((revision) => (
                  <option key={revision.id} value={revision.id}>
                    Revision #{revision.revisionNumber}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!revisionState.canCreatePlan && (
            <p className="text-muted-foreground text-sm">
              No generated revision is available to deploy.
            </p>
          )}
          <button
            disabled={busy || !selectedRevisionId}
            className="bg-primary text-primary-foreground rounded-lg px-4 py-3"
            onClick={() =>
              void perform(async () =>
                setPlan(
                  await dashboardApi.createDeploymentPlan(
                    projectId,
                    connection.id,
                    selectedRevisionId!,
                  ),
                ),
              )
            }
          >
            {busy ? 'Comparing site…' : 'Create deployment plan'}
          </button>
          {busy && (
            <div
              className="h-2 overflow-hidden rounded bg-slate-200"
              role="progressbar"
              aria-label="Collecting WordPress snapshot"
            >
              <div className="bg-primary h-full w-2/3 animate-pulse" />
            </div>
          )}
        </section>
      )}
      {plan && (
        <>
          <div className="flex justify-end">
            <Link
              className="text-primary text-sm font-medium"
              href={`/dashboard/projects/${projectId}/deployment-plans/${plan.id}`}
            >
              Open this saved revision review →
            </Link>
          </div>
          <RevisionViewer plan={plan} />
        </>
      )}
      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
