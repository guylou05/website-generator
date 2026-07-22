import { notFound } from 'next/navigation';
import { dashboardApi } from '@/lib/api-client';
import { GenerationActions } from '@/components/generation-actions';
import Link from 'next/link';

export default async function ProjectDetail({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const [project, deployments] = await Promise.all([
    dashboardApi.project(projectId).catch(() => null),
    dashboardApi.deployments(projectId).catch(() => []),
  ]);
  if (!project) notFound();
  const run = project.generationRuns[0];
  const summary = run?.output?.summary;
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
          runId={run?.id}
          retryable={run?.status === 'failed' || run?.status === 'cancelled'}
        />
        {run?.status === 'completed' && (
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
          value={String(summary?.pages_generated ?? 0)}
        />
        <Metric
          label="Blueprint validation"
          value={summary?.blueprint_valid ? 'Validated' : 'Not validated'}
        />
        <Metric
          label="Elementor render"
          value={summary?.elementor_ready ? 'Ready' : 'Not ready'}
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
