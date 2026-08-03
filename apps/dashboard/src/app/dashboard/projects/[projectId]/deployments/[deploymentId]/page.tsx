'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  DashboardApiError,
  dashboardApi,
  type Deployment,
} from '@/lib/api-client';
import { pollDeployment } from '@/lib/deployment-polling';
import { RequestErrorPanel } from '@/components/request-error-panel';

const stages = [
  ['connection', 'Connection verified'],
  ['snapshot', 'Rollback snapshot captured'],
  ['media_prepare', 'Media prepared'],
  ['media_upload', 'Media uploaded'],
  ['pages_create', 'Pages created'],
  ['pages_update', 'Pages updated'],
  ['elementor', 'Elementor documents applied'],
  ['seo', 'SEO applied'],
  ['navigation', 'Navigation updated'],
  ['homepage', 'Homepage configured'],
  ['site_settings', 'Site settings applied'],
  ['css', 'Elementor CSS regenerated'],
  ['verify', 'Remote state verified'],
  ['finalize', 'Deployment finalized'],
] as const;
const terminal = new Set([
  'succeeded',
  'failed',
  'partially_succeeded',
  'cancelled',
]);
const date = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(value))
    : 'Not started';
const duration = (ms: number | null) =>
  ms == null ? '—' : ms < 1000 ? `${ms} ms` : `${Math.round(ms / 1000)}s`;
const label = (value: string) => value.replaceAll('_', ' ');
const safeUrl = (value: string | null) => {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
};

export default function DeploymentProgressPage() {
  const { projectId, deploymentId } = useParams<{
    projectId: string;
    deploymentId: string;
  }>();
  const router = useRouter();
  const [deployment, setDeployment] = useState<Deployment>();
  const [error, setError] = useState('');
  const [requestId, setRequestId] = useState<string>();
  const [reload, setReload] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  useEffect(
    () =>
      pollDeployment({
        load: (signal) => dashboardApi.deployment(deploymentId, signal),
        onData: (next) => {
          setDeployment(next);
          setError('');
          setRequestId(undefined);
        },
        onError: (reason) => {
          setError(
            reason instanceof Error
              ? reason.message
              : 'Connection lost. Reconnecting…',
          );
          setRequestId(
            reason instanceof DashboardApiError ? reason.requestId : undefined,
          );
        },
      }),
    [deploymentId, reload],
  );
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const events = useMemo(
    () =>
      [...(deployment?.events ?? [])].sort(
        (a, b) =>
          a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
      ),
    [deployment],
  );
  if (!deployment)
    return (
      <div className="card p-8">
        {error ? (
          <RequestErrorPanel
            message={error}
            requestId={requestId}
            onRetry={() => setReload((x) => x + 1)}
          />
        ) : (
          'Loading persisted deployment progress…'
        )}
      </div>
    );
  const elapsed =
    deployment.durationMs ??
    (deployment.startedAt
      ? new Date(
          deployment.completedAt ??
            deployment.failedAt ??
            deployment.cancelledAt ??
            now,
        ).getTime() - new Date(deployment.startedAt).getTime()
      : null);
  const siteUrl = safeUrl(
    deployment.wordpressConnection?.site_url ??
      deployment.result?.site_url ??
      null,
  );
  const canRetry = deployment.retryAllowed;
  return (
    <div className="space-y-6 pb-12">
      <header className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-primary text-sm font-medium">
              Deployment #{deployment.id.slice(0, 8)} · Attempt{' '}
              {deployment.attempt}
            </p>
            <h1 className="text-3xl font-semibold">
              {deployment.project?.name ?? 'WordPress deployment'}
            </h1>
            <p className="text-muted-foreground mt-1">
              {deployment.wordpressConnection?.name ??
                siteUrl ??
                'WordPress site'}
            </p>
          </div>
          <span
            role="status"
            className="rounded-full border px-3 py-1 text-sm font-semibold capitalize"
          >
            {deployment.status === 'succeeded'
              ? '✓ '
              : deployment.status === 'failed'
                ? '✕ '
                : deployment.status === 'cancelled'
                  ? '■ '
                  : '● '}
            {label(deployment.status)}
          </span>
        </div>
        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
          <Meta
            title="Source revision"
            value={
              deployment.websiteRevision
                ? `#${deployment.websiteRevision.revision_number}`
                : (deployment.websiteRevisionId?.slice(0, 8) ?? '—')
            }
          />
          <Meta
            title="Approved plan"
            value={deployment.deploymentPlanId?.slice(0, 8) ?? '—'}
          />
          <Meta
            title="Initiated by"
            value={deployment.createdBy?.slice(0, 8) ?? 'Current user'}
          />
          <Meta
            title="Started"
            value={date(deployment.startedAt ?? deployment.queuedAt)}
          />
          <Meta title="Elapsed" value={duration(elapsed)} />
          <Meta
            title="Current stage"
            value={
              deployment.currentStage
                ? label(deployment.currentStage)
                : deployment.status === 'succeeded'
                  ? 'Finalized'
                  : terminal.has(deployment.status)
                    ? 'Stopped'
                    : 'Waiting for worker'
            }
          />
        </dl>
        <div className="mt-6 flex justify-between text-sm font-medium">
          <span>
            {deployment.currentStage
              ? label(deployment.currentStage)
              : 'Queued for deployment'}
          </span>
          <span>{deployment.progress}%</span>
        </div>
        <div
          className="mt-2 h-3 overflow-hidden rounded-full bg-slate-200"
          role="progressbar"
          aria-valuenow={deployment.progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="bg-primary h-full transition-all"
            style={{ width: `${deployment.progress}%` }}
          />
        </div>
        {error && (
          <p className="mt-3 rounded bg-amber-50 p-3 text-sm text-amber-900">
            ⚠ Live updates interrupted. Showing the last saved state and
            reconnecting automatically.
            {requestId ? ` Reference: ${requestId}` : ''}
          </p>
        )}
      </header>

      {deployment.status === 'partially_succeeded' && (
        <section className="rounded-lg border border-amber-300 bg-amber-50 p-5">
          <h2 className="font-semibold">⚠ Deployment partially succeeded</h2>
          <p className="mt-1 text-sm">
            Completed changes remain in WordPress. Review failed and skipped
            items below, then retry only the safe failures.
          </p>
        </section>
      )}
      {deployment.error && (
        <section className="rounded-lg border border-red-200 bg-red-50 p-5">
          <h2 className="font-semibold text-red-900">
            Deployment needs attention
          </h2>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <Meta
              title="Failed stage"
              value={
                deployment.currentStage
                  ? label(deployment.currentStage)
                  : 'See activity log'
              }
            />
            <Meta title="Error code" value={deployment.error.code} />
            <Meta title="Actionable message" value={deployment.error.message} />
            <Meta
              title="Retryability"
              value={
                deployment.error.retryable ? 'Safe to retry' : 'Not retryable'
              }
            />
            <Meta
              title="Suggested action"
              value={
                deployment.error.suggested_action ??
                'Review the technical details and verify WordPress connectivity.'
              }
            />
            <Meta
              title="Request reference"
              value={String(
                deployment.error.details?.request_id ?? requestId ?? '—',
              )}
            />
          </dl>
          <details className="mt-4">
            <summary className="cursor-pointer font-medium">
              Technical details
            </summary>
            <pre className="mt-2 overflow-auto rounded bg-white p-3 text-xs">
              {JSON.stringify(
                deployment.errorDetails ??
                  deployment.error.details ?? { code: deployment.error.code },
                null,
                2,
              )}
            </pre>
          </details>
        </section>
      )}

      <section className="card p-6">
        <h2 className="text-lg font-semibold">Execution stages</h2>
        <div className="mt-4 space-y-2">
          {stages.map(([key, title], index) => {
            const stageEvents = events.filter(
              (e) => e.stage === key || e.stage.includes(key),
            );
            const failed = stageEvents.some((e) =>
              e.eventType.includes('failed'),
            );
            const done = stageEvents.some((e) =>
              e.eventType.includes('completed'),
            );
            const running =
              deployment.currentStage?.includes(key) &&
              !terminal.has(deployment.status);
            const state = failed
              ? 'failed'
              : done
                ? 'completed'
                : running
                  ? 'running'
                  : deployment.status === 'cancelled' &&
                      index * (100 / stages.length) >= deployment.progress
                    ? 'cancelled'
                    : 'pending';
            return (
              <details key={key} className="rounded-lg border p-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                  <span>
                    <b aria-hidden>
                      {state === 'completed'
                        ? '✓'
                        : state === 'failed'
                          ? '✕'
                          : state === 'running'
                            ? '●'
                            : '○'}
                    </b>{' '}
                    <span className="font-medium">
                      {index + 1}. {title}
                    </span>
                  </span>
                  <span className="text-muted-foreground text-xs capitalize">
                    {state} · retries{' '}
                    {
                      stageEvents.filter(
                        (e) => e.eventType === 'stage.retrying',
                      ).length
                    }
                  </span>
                </summary>
                {stageEvents.length ? (
                  <div className="mt-3 space-y-2 border-t pt-3">
                    {stageEvents.map((e) => (
                      <div key={e.id} className="text-sm">
                        <span className="text-muted-foreground">
                          {date(e.createdAt)}
                        </span>{' '}
                        · {e.message}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground mt-2 text-sm">
                    No persisted events yet.
                  </p>
                )}
              </details>
            );
          })}
        </div>
      </section>

      <section className="card p-6">
        <h2 className="text-lg font-semibold">Item results</h2>
        {deployment.items.length === 0 ? (
          <p className="text-muted-foreground mt-3 text-sm">
            Item results will appear as operations complete.
          </p>
        ) : (
          <div className="mt-4 space-y-6">
            {[
              'page',
              'media',
              'navigation',
              'homepage',
              'seo',
              'elementor',
            ].map((type) => {
              const items = deployment.items.filter((i) =>
                i.resourceType.toLowerCase().includes(type),
              );
              if (!items.length) return null;
              return (
                <div key={type}>
                  <h3 className="font-semibold capitalize">{type}</h3>
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="py-2">Item</th>
                          <th>Planned action</th>
                          <th>Result</th>
                          <th>Remote ID</th>
                          <th>Warnings / errors</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item) => (
                          <tr className="border-b" key={item.id}>
                            <td className="py-3 font-medium">
                              {String(
                                item.result?.title ??
                                  item.result?.filename ??
                                  item.resourceKey,
                              )}
                            </td>
                            <td>{label(item.operation)}</td>
                            <td className="capitalize">{label(item.status)}</td>
                            <td>
                              {safeUrl(item.remoteUrl) ? (
                                <a
                                  className="text-primary underline"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  href={safeUrl(item.remoteUrl)!}
                                >
                                  {item.remoteId ?? 'Open in WordPress'}
                                </a>
                              ) : (
                                (item.remoteId ?? '—')
                              )}
                            </td>
                            <td>
                              {String(
                                item.error?.message ??
                                  item.result?.warning ??
                                  '—',
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="card p-6">
        <h2 className="text-lg font-semibold">Persistent activity log</h2>
        {events.length === 0 ? (
          <p className="text-muted-foreground mt-3 text-sm">
            No events recorded yet.
          </p>
        ) : (
          <ol className="mt-4 space-y-3">
            {events.map((event) => (
              <li className="border-l-2 pl-3 text-sm" key={event.id}>
                <div className="flex justify-between gap-3">
                  <strong>{label(event.eventType)}</strong>
                  <time className="text-muted-foreground">
                    {date(event.createdAt)}
                  </time>
                </div>
                <p>{event.message}</p>
                <span className="text-muted-foreground">
                  {label(event.stage)} · {event.progress ?? deployment.progress}
                  % · {event.severity}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="flex flex-wrap gap-3">
        {['queued', 'running'].includes(deployment.status) && (
          <button
            disabled={busy}
            className="rounded border px-4 py-2"
            onClick={async () => {
              if (
                !window.confirm(
                  'Completed operations will remain in WordPress. Cancellation stops before the next safe operation.',
                )
              )
                return;
              setBusy(true);
              try {
                setDeployment(
                  await dashboardApi.cancelDeployment(deployment.id),
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            Cancel Deployment
          </button>
        )}
        {canRetry && (
          <button
            disabled={busy}
            className="bg-primary text-primary-foreground rounded px-4 py-2"
            onClick={async () => {
              if (
                !window.confirm(
                  'Create a new deployment attempt? The failed attempt will remain in audit history.',
                )
              )
                return;
              setBusy(true);
              try {
                const retry = await dashboardApi.retryDeployment(deployment.id);
                router.push(
                  `/dashboard/projects/${projectId}/deployments/${retry.id}`,
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            Retry Deployment
          </button>
        )}
        {!canRetry &&
          deployment.retryReason &&
          terminal.has(deployment.status) && (
            <p className="text-muted-foreground self-center text-sm">
              {deployment.retryReason}
            </p>
          )}
        {siteUrl && (
          <a
            className="rounded border px-4 py-2"
            target="_blank"
            rel="noopener noreferrer"
            href={siteUrl}
          >
            View WordPress site
          </a>
        )}
        <Link
          className="rounded border px-4 py-2"
          href={`/dashboard/projects/${projectId}`}
        >
          View project
        </Link>
        {deployment.deploymentPlanId && (
          <Link
            className="rounded border px-4 py-2"
            href={`/dashboard/projects/${projectId}/deployment-plans/${deployment.deploymentPlanId}`}
          >
            View deployment plan
          </Link>
        )}
        <Link
          className="rounded border px-4 py-2"
          href={`/dashboard/projects/${projectId}/deploy`}
        >
          Start another deployment
        </Link>
      </div>
    </div>
  );
}
function Meta({ title, value }: { title: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{title}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}
