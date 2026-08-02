import { notFound } from 'next/navigation';
import { dashboardApi } from '@/lib/api-client';
import { DeploymentWorkflow } from './deployment-workflow';
export default async function DeployPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const [project, connections] = await Promise.all([
    dashboardApi.project(projectId).catch(() => null),
    dashboardApi.connections(projectId).catch(() => []),
  ]);
  if (!project) notFound();
  const run = project.generationRuns.find((x) => x.status === 'completed');
  if (!run) notFound();
  return (
    <div className="space-y-6">
      <header>
        <p className="text-primary text-sm font-medium">Prepare deployment</p>
        <h1 className="text-3xl font-semibold">Deploy {project.name}</h1>
      </header>
      <DeploymentWorkflow
        projectId={projectId}
        runId={run.id}
        initialConnections={connections}
      />
    </div>
  );
}
