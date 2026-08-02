'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  dashboardApi,
  type Deployment,
  type GenerationSummary,
  type Project,
} from '@/lib/api-client';
import { GenerationActions } from '@/components/generation-actions';
import Link from 'next/link';

const activeGenerationStatuses = new Set(['queued', 'running', 'cancelling']);

export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [summary, setSummary] = useState<GenerationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      dashboardApi.project(projectId),
      dashboardApi.deployments(projectId),
      dashboardApi.generationSummary(projectId),
    ])
      .then(([nextProject, nextDeployments, nextSummary]) => {
        setProject(nextProject);
        setDeployments(nextDeployments);
        setSummary(nextSummary);
      })
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error
            ? reason.message
            : 'This project could not be loaded.',
        ),
      )
      .finally(() => setLoading(false));
  }, [projectId]);

  const latestRun = project?.generationRuns[0];
  useEffect(() => {
    if (!latestRun || !activeGenerationStatuses.has(latestRun.status)) return;
    const timer = window.setInterval(() => {
      void dashboardApi
        .project(projectId)
        .then(setProject)
        .catch(() => undefined);
    }, 2500);
    return () => window.clearInterval(timer);
  }, [latestRun, projectId]);

  if (loading)
    return (
      <div
        className="bg-muted h-80 animate-pulse rounded-xl"
        aria-label="Loading project"
      />
    );
  if (!project)
    return (
      <section className="card p-8 text-center" role="alert">
        <h1 className="text-xl font-semibold">Project unavailable</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          {error || 'The project was not found.'}
        </p>
        <Link
          href="/dashboard/projects"
          className="text-primary mt-5 inline-block text-sm font-medium"
        >
          Back to projects
        </Link>
      </section>
    );
  const run = project.generationRuns[0];
  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-primary text-sm font-medium">Project</p>
          <h1 className="mt-1 text-3xl font-semibold">{project.name}</h1>
          <span className="bg-muted mt-3 inline-block rounded-full px-3 py-1 text-xs capitalize">
            {project.status}
          </span>
        </div>
        <GenerationActions
          run={run}
          onGenerationChange={(nextRun) =>
            setProject((current) =>
              current
                ? {
                    ...current,
                    generationRuns: [
                      nextRun,
                      ...current.generationRuns.filter(
                        (item) => item.id !== nextRun.id,
                      ),
                    ],
                  }
                : current,
            )
          }
        />
        {summary?.deploymentReady && (
          <Link
            className="bg-primary text-primary-foreground rounded-lg px-4 py-2.5 text-sm font-medium"
            href={`/dashboard/projects/${projectId}/deploy`}
          >
            Prepare Deployment
          </Link>
        )}
      </header>
      <section className="grid gap-4 sm:grid-cols-3">
        <Metric
          label="Pages generated"
          value={String(summary?.pageCount ?? 0)}
        />
        <Metric
          label="Blueprint validation"
          value={statusLabel(summary?.blueprintStatus ?? 'not_generated')}
        />
        <Metric
          label="Elementor render"
          value={statusLabel(summary?.elementorStatus ?? 'not_ready')}
        />
      </section>
      <section className="card p-6">
        <h2 className="font-semibold">Business profile</h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          {Object.entries(project.businessProfile).map(([key, value]) => (
            <div key={key}>
              <dt className="text-muted-foreground text-xs capitalize">
                {key.replaceAll(/([A-Z_])/g, ' $1')}
              </dt>
              <dd className="mt-1 text-sm">
                {Array.isArray(value) ? value.join(', ') : String(value)}
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="card p-6">
        <h2 className="font-semibold">Deployment history</h2>
        <div className="mt-4 space-y-3">
          {deployments.length === 0 && (
            <p className="text-muted-foreground text-sm">No deployments yet.</p>
          )}
          {deployments.map((deployment) => (
            <div
              key={deployment.id}
              className="flex justify-between border-l-2 pl-4 text-sm"
            >
              <span>{deployment.dryRun ? 'Preview' : 'Live deployment'}</span>
              <span className="capitalize">
                {deployment.status} · {deployment.progress}%
              </span>
            </div>
          ))}
        </div>
      </section>
      <section className="card p-6">
        <h2 className="font-semibold">Generation timeline</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Last generation:{' '}
          <span className="capitalize">{run?.status ?? 'Not started'}</span>
        </p>
        {run?.status === 'cancelling' && (
          <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            Cancellation requested. The job will stop when the worker next
            checks its status.
          </p>
        )}
        <div className="mt-5 space-y-3">
          {run?.events.map((event) => (
            <div key={event.id} className="flex gap-3 border-l-2 pl-4">
              <div className="flex-1">
                <p className="text-sm font-medium capitalize">{event.stage}</p>
                <p className="text-muted-foreground text-xs">{event.message}</p>
              </div>
              <span className="text-muted-foreground text-xs">
                {event.progress ?? 0}%
              </span>
            </div>
          ))}
        </div>
        {run?.error && (
          <p className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {run.error.message}
          </p>
        )}
      </section>
    </div>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-5">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  );
}

function statusLabel(status: string): string {
  return status
    .replaceAll('_', ' ')
    .replace(/^./, (letter) => letter.toUpperCase());
}
