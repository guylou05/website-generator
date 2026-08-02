'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  dashboardApi,
  type GenerationSummary,
  type Project,
  type WordPressConnection,
} from '@/lib/api-client';
import { DeploymentWorkflow } from './deployment-workflow';

export default function DeployPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [data, setData] = useState<{
    project: Project;
    summary: GenerationSummary;
    connections: WordPressConnection[];
    revisions: Awaited<ReturnType<typeof dashboardApi.revisions>>;
  }>();
  const [error, setError] = useState('');
  useEffect(() => {
    Promise.all([
      dashboardApi.project(projectId),
      dashboardApi.generationSummary(projectId),
      dashboardApi.connections(projectId),
      dashboardApi.revisions(projectId),
    ])
      .then(([project, summary, connections, revisions]) =>
        setData({ project, summary, connections, revisions }),
      )
      .catch((e: unknown) =>
        setError(
          e instanceof Error
            ? e.message
            : 'Deployment preparation could not be loaded.',
        ),
      );
  }, [projectId]);
  if (error)
    return (
      <div className="card p-8 text-red-700" role="alert">
        <h1 className="text-xl font-semibold">Unable to prepare deployment</h1>
        <p className="mt-2">{error}</p>
      </div>
    );
  if (!data)
    return (
      <div
        className="bg-muted h-80 animate-pulse rounded-xl"
        aria-label="Loading deployment preparation"
      />
    );
  if (!data.summary.deploymentReady)
    return (
      <div className="card p-8">
        <h1 className="text-xl font-semibold">Generation required</h1>
        <p className="text-muted-foreground mt-2">
          Complete generation, blueprint validation, and Elementor rendering
          before deploying.
        </p>
      </div>
    );
  const run = data.project.generationRuns.find((item) =>
    ['completed', 'succeeded'].includes(item.status),
  );
  if (!run) return null;
  return (
    <div className="space-y-6">
      <header>
        <p className="text-primary text-sm font-medium">Prepare deployment</p>
        <h1 className="text-3xl font-semibold">Deploy {data.project.name}</h1>
      </header>
      <section className="grid gap-3 sm:grid-cols-4">
        {[
          ['Pages', data.summary.pageCount],
          ['Blueprint', data.summary.blueprintStatus],
          ['Elementor', data.summary.elementorStatus],
          [
            'Revision',
            `#${data.summary.latestRevision?.revisionNumber ?? '—'}`,
          ],
        ].map(([label, value]) => (
          <div className="card p-4" key={label}>
            <p className="text-muted-foreground text-xs">{label}</p>
            <p className="mt-1 font-semibold capitalize">{value}</p>
          </div>
        ))}
      </section>
      <DeploymentWorkflow
        projectId={projectId}
        runId={run.id}
        initialConnections={data.connections}
        revisions={data.revisions}
      />
    </div>
  );
}
