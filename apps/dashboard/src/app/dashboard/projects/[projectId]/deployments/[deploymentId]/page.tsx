'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { dashboardApi, type Deployment } from '@/lib/api-client';

const stages = [
  'Connection verified',
  'Media uploaded',
  'Pages created',
  'Elementor data applied',
  'SEO applied',
  'Menus configured',
  'Homepage configured',
  'Elementor CSS regenerated',
  'Deployment completed',
];
export default function DeploymentProgressPage() {
  const { projectId, deploymentId } = useParams<{
    projectId: string;
    deploymentId: string;
  }>();
  const [deployment, setDeployment] = useState<Deployment>();
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const load = () =>
      dashboardApi
        .deployment(deploymentId)
        .then((x) => {
          if (active) setDeployment(x);
        })
        .catch((e) =>
          setError(
            e instanceof Error ? e.message : 'Could not load deployment.',
          ),
        );
    void load();
    const timer = window.setInterval(load, 2500);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [deploymentId]);
  if (!deployment)
    return (
      <div className="card p-8">{error || 'Loading deployment progress…'}</div>
    );
  const completed = Math.floor((deployment.progress / 100) * stages.length);
  return (
    <div className="space-y-6">
      <header>
        <p className="text-primary text-sm font-medium">WordPress deployment</p>
        <h1 className="text-3xl font-semibold">Deployment progress</h1>
        <p className="text-muted-foreground mt-2 capitalize">
          {deployment.status} · {deployment.progress}%
        </p>
      </header>
      <div className="h-2 overflow-hidden rounded bg-slate-200">
        <div
          className="bg-primary h-full"
          style={{ width: `${deployment.progress}%` }}
        />
      </div>
      <section className="card p-6">
        <div className="space-y-3">
          {stages.map((stage, index) => (
            <div className="flex gap-3" key={stage}>
              <span aria-hidden>
                {index < completed ? '✓' : index === completed ? '●' : '○'}
              </span>
              <span
                className={
                  index <= completed ? 'font-medium' : 'text-muted-foreground'
                }
              >
                {stage}
              </span>
            </div>
          ))}
        </div>
      </section>
      {deployment.events.length > 0 && (
        <section className="card p-6">
          <h2 className="font-semibold">Activity</h2>
          {deployment.events.map((event) => (
            <div className="mt-3 border-l-2 pl-3 text-sm" key={event.id}>
              <strong>{event.stage}</strong>
              <p>{event.message}</p>
            </div>
          ))}
        </section>
      )}
      {deployment.error && (
        <p className="rounded bg-red-50 p-4 text-red-800">
          <strong>{deployment.error.code}</strong>: {deployment.error.message}
        </p>
      )}
      <div className="flex gap-3">
        {['failed', 'cancelled', 'stale'].includes(deployment.status) && (
          <button
            className="rounded border px-4 py-2"
            onClick={() =>
              void dashboardApi
                .retryDeployment(deployment.id)
                .then(setDeployment)
            }
          >
            Retry
          </button>
        )}
        {['queued', 'running'].includes(deployment.status) && (
          <button
            className="rounded border px-4 py-2"
            onClick={() =>
              void dashboardApi
                .cancelDeployment(deployment.id)
                .then(setDeployment)
            }
          >
            Cancel
          </button>
        )}
        <Link
          className="rounded border px-4 py-2"
          href={`/dashboard/projects/${projectId}`}
        >
          Back to project
        </Link>
      </div>
      {deployment.result?.site_url && (
        <a
          className="text-primary underline"
          href={deployment.result.site_url}
          target="_blank"
          rel="noreferrer"
        >
          Open WordPress site
        </a>
      )}
    </div>
  );
}
