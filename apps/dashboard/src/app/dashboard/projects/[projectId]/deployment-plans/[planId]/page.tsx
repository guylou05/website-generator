'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { RevisionViewer } from '@/components/revision-viewer';
import { dashboardApi, type DeploymentPlan } from '@/lib/api-client';

export default function SavedDeploymentPlanPage() {
  const { projectId, planId } = useParams<{
    projectId: string;
    planId: string;
  }>();
  const [plan, setPlan] = useState<DeploymentPlan>();
  const [error, setError] = useState('');

  useEffect(() => {
    dashboardApi
      .deploymentPlan(planId)
      .then(setPlan)
      .catch((failure: unknown) =>
        setError(
          failure instanceof Error
            ? failure.message
            : 'The saved deployment plan could not be loaded.',
        ),
      );
  }, [planId]);

  return (
    <div className="space-y-6">
      <header>
        <Link
          className="text-primary text-sm font-medium"
          href={`/dashboard/projects/${projectId}/deploy`}
        >
          ← Back to deployment preparation
        </Link>
        <h1 className="mt-2 text-3xl font-semibold">Revision review</h1>
      </header>
      {error && (
        <p className="card p-6 text-red-700" role="alert">
          {error}
        </p>
      )}
      {!plan && !error && (
        <div
          className="bg-muted h-96 animate-pulse rounded-xl"
          aria-label="Loading saved revision review"
        />
      )}
      {plan && <RevisionViewer plan={plan} />}
    </div>
  );
}
