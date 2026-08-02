'use client';
import Link from 'next/link';
import { useState } from 'react';
import {
  dashboardApi,
  type DeploymentPlan,
  type WordPressConnection,
} from '@/lib/api-client';

export function DeploymentWorkflow({
  projectId,
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
          <button
            disabled={busy}
            className="bg-primary text-primary-foreground rounded-lg px-4 py-3"
            onClick={() =>
              void perform(async () =>
                setPlan(
                  await dashboardApi.createDeploymentPlan(
                    projectId,
                    connection.id,
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
        <section className="card space-y-4 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Deployment plan</h2>
              <p className="text-muted-foreground text-sm">
                Estimated deployment time:{' '}
                {plan.estimatedSeconds < 60
                  ? `${plan.estimatedSeconds} seconds`
                  : `${Math.ceil(plan.estimatedSeconds / 60)} minutes`}
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${plan.safetyStatus === 'safe' ? 'bg-emerald-100 text-emerald-800' : plan.safetyStatus === 'warning' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}
            >
              {plan.safetyStatus === 'safe'
                ? 'Safe to review'
                : plan.safetyStatus === 'warning'
                  ? 'Review warnings'
                  : 'Blocked'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Total', plan.statistics.total],
              ['Create', plan.statistics.create],
              ['Update', plan.statistics.update],
              ['Unchanged', plan.statistics.unchanged],
            ].map(([label, value]) => (
              <div className="rounded-lg bg-slate-50 p-3" key={label}>
                <p className="text-muted-foreground text-xs uppercase">
                  {label}
                </p>
                <p className="text-2xl font-semibold">{value}</p>
              </div>
            ))}
          </div>
          {plan.warnings.map((warning) => (
            <p
              className="rounded bg-amber-50 p-3 text-sm text-amber-900"
              key={warning}
            >
              ⚠ {warning}
            </p>
          ))}
          <div className="space-y-2">
            {Object.entries(
              Object.groupBy(plan.changes, (change) => change.resource),
            ).map(([resource, changes]) => (
              <details className="rounded-lg border p-3" key={resource}>
                <summary className="cursor-pointer font-medium capitalize">
                  {resource}{' '}
                  <span className="text-muted-foreground font-normal">
                    ({changes?.length ?? 0})
                  </span>
                </summary>
                <div className="mt-3 space-y-2">
                  {changes?.map((change) => (
                    <div
                      className="flex flex-wrap justify-between gap-2 border-t pt-2 text-sm"
                      key={`${change.action}-${change.identifier}`}
                    >
                      <div>
                        <strong>{change.label}</strong>
                        <p className="text-muted-foreground">{change.reason}</p>
                      </div>
                      <span className="h-fit rounded bg-slate-100 px-2 py-1 capitalize">
                        {change.action}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
          <p className="text-muted-foreground text-xs">
            Plan saved at {new Date(plan.createdAt).toLocaleString()}. Approval
            and deployment are intentionally unavailable in Phase 5.1.
          </p>
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
