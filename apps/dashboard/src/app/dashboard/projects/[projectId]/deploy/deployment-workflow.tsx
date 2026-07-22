'use client';
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
  const perform = async (fn: () => Promise<unknown>) => {
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
      <form
        className="card grid gap-4 p-6"
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          void perform(async () => {
            const next = await dashboardApi.createConnection(projectId, {
              site_url: String(data.get('site_url')),
              username: String(data.get('username')),
              application_password: String(data.get('application_password')),
            });
            setConnections([next, ...connections]);
            setConnection(next);
          });
        }}
      >
        <h2 className="text-lg font-semibold">WordPress connection</h2>
        <input
          className="rounded-lg border p-3"
          name="site_url"
          type="url"
          placeholder="https://example.com"
          required
        />
        <input
          className="rounded-lg border p-3"
          name="username"
          placeholder="Username"
          required
        />
        <input
          className="rounded-lg border p-3"
          name="application_password"
          type="password"
          placeholder="Application Password"
          required
        />
        <button
          disabled={busy}
          className="bg-primary text-primary-foreground rounded-lg p-3"
        >
          Save connection
        </button>
      </form>
      {connection && (
        <section className="card space-y-4 p-6">
          <div className="flex justify-between">
            <div>
              <h2 className="font-semibold">{connection.siteUrl}</h2>
              <p className="text-muted-foreground text-sm">
                Connector: {connection.connectorVersion ?? connection.status} ·
                Elementor: {connection.elementorVersion ?? 'not verified'}
              </p>
            </div>
            <button
              className="rounded-lg border px-4"
              disabled={busy}
              onClick={() =>
                void perform(async () => {
                  const next = await dashboardApi.verifyConnection(
                    connection.id,
                  );
                  setConnection(next);
                })
              }
            >
              Verify connection
            </button>
          </div>
          <button
            disabled={busy || connection.status !== 'verified'}
            className="bg-primary text-primary-foreground rounded-lg px-4 py-3"
            onClick={() =>
              void perform(async () =>
                setDeployment(
                  await dashboardApi.previewDeployment(projectId, {
                    generation_run_id: runId,
                    wordpress_connection_id: connection.id,
                  }),
                ),
              )
            }
          >
            Preview deployment
          </button>
        </section>
      )}
      {deployment && (
        <section className="card space-y-4 p-6">
          <h2 className="text-lg font-semibold">
            {deployment.dryRun ? 'Deployment preview' : 'Deployment progress'} ·{' '}
            {deployment.progress}%
          </h2>
          <div className="space-y-2">
            {deployment.operations?.map((op, i) => (
              <p className="rounded bg-slate-50 p-3 text-sm" key={i}>
                <strong>{op.action}</strong> {op.resource}: {op.identifier}
              </p>
            ))}
          </div>
          {deployment.dryRun && deployment.status === 'completed' && (
            <button
              disabled={busy}
              className="bg-primary text-primary-foreground rounded-lg px-4 py-3"
              onClick={() => {
                if (confirm('Deploy these changes to WordPress?'))
                  void perform(async () =>
                    setDeployment(
                      await dashboardApi.deploy(projectId, {
                        generation_run_id: runId,
                        wordpress_connection_id: connection!.id,
                      }),
                    ),
                  );
              }}
            >
              Confirm live deployment
            </button>
          )}
          {deployment.result?.site_url && (
            <div className="flex gap-3">
              <a className="underline" href={deployment.result.site_url}>
                Open Website
              </a>
              <a className="underline" href={deployment.result.admin_url}>
                View WordPress Admin
              </a>
            </div>
          )}
          {deployment.error && (
            <button
              onClick={() =>
                void perform(async () =>
                  setDeployment(
                    await dashboardApi.retryDeployment(deployment.id),
                  ),
                )
              }
            >
              Retry: {deployment.error.message}
            </button>
          )}
        </section>
      )}
      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>
      )}
    </div>
  );
}
