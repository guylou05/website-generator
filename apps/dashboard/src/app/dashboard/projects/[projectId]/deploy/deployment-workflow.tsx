'use client';
import Link from 'next/link';
import { useState } from 'react';
import {
  dashboardApi,
  type Deployment,
  type WordPressConnection,
} from '@/lib/api-client';

export function DeploymentWorkflow({
  projectId,
  runId,
  initialConnections,
}: {
  projectId: string;
  runId: string;
  initialConnections: WordPressConnection[];
}) {
  const [connections, setConnections] = useState(initialConnections);
  const [connection, setConnection] = useState<WordPressConnection | undefined>(
    initialConnections[0],
  );
  const [deployment, setDeployment] = useState<Deployment>();
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
  const options = (form?: HTMLFormElement) => {
    const data = form ? new FormData(form) : new FormData();
    return {
      generation_run_id: runId,
      wordpress_connection_id: connection!.id,
      included_pages: [],
      overwrite_existing: data.get('overwrite') === 'on',
      set_homepage: data.get('homepage') === 'on',
      update_navigation: data.get('navigation') === 'on',
      regenerate_elementor_css: data.get('css') === 'on',
      page_status:
        data.get('status') === 'publish'
          ? ('publish' as const)
          : ('draft' as const),
    };
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
        <form
          className="card space-y-4 p-6"
          onSubmit={(e) => {
            e.preventDefault();
            void perform(async () =>
              setDeployment(
                await dashboardApi.previewDeployment(
                  projectId,
                  options(e.currentTarget),
                ),
              ),
            );
          }}
        >
          <div>
            <h2 className="text-lg font-semibold">Deployment review</h2>
            <p className="text-muted-foreground text-sm">
              Dry run compares pages, media, menus, homepage, Elementor
              documents, site settings, and SEO without modifying WordPress.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <input name="overwrite" type="checkbox" /> Overwrite reviewed
              existing pages
            </label>
            <label>
              <input name="homepage" type="checkbox" /> Set homepage
            </label>
            <label>
              <input name="navigation" type="checkbox" /> Update navigation
            </label>
            <label>
              <input name="css" type="checkbox" defaultChecked /> Regenerate
              Elementor CSS
            </label>
            <label>
              Page status{' '}
              <select name="status" className="ml-2 rounded border p-1">
                <option value="draft">Draft (safe default)</option>
                <option value="publish">Publish</option>
              </select>
            </label>
          </div>
          <p className="rounded bg-amber-50 p-3 text-sm text-amber-900">
            Existing content is never deleted. Existing pages are not
            overwritten unless explicitly selected.
          </p>
          <button
            disabled={busy}
            className="bg-primary text-primary-foreground rounded-lg px-4 py-3"
          >
            Run dry run
          </button>
        </form>
      )}
      {deployment && (
        <section className="card space-y-4 p-6">
          <h2 className="text-lg font-semibold">
            {deployment.dryRun ? 'Dry-run result' : 'Deployment'} ·{' '}
            {deployment.progress}%
          </h2>
          <div className="space-y-2">
            {deployment.operations?.map((op, i) => (
              <p className="rounded bg-slate-50 p-3 text-sm" key={i}>
                <strong>{op.action}</strong> {op.resource}: {op.identifier}
              </p>
            )) ?? (
              <p className="text-muted-foreground text-sm">
                Queued on the wordpress-deployment worker. Open progress to
                follow each stage.
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              className="rounded-lg border px-4 py-2"
              href={`/dashboard/projects/${projectId}/deployments/${deployment.id}`}
            >
              View progress
            </Link>
            {deployment.dryRun &&
              ['succeeded', 'completed'].includes(deployment.status) && (
                <button
                  disabled={busy}
                  className="bg-primary text-primary-foreground rounded-lg px-4 py-2"
                  onClick={() =>
                    void perform(async () =>
                      setDeployment(
                        await dashboardApi.deploy(projectId, options()),
                      ),
                    )
                  }
                >
                  Start deployment
                </button>
              )}
          </div>
        </section>
      )}
      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
