'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Clock3,
  FilePlus2,
  Globe2,
  RotateCw,
  Rocket,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import {
  dashboardApi,
  DashboardApiError,
  type DashboardOverview,
} from '@/lib/api-client';

const dateTime = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
const duration = (seconds: number | null) =>
  seconds === null
    ? 'No data yet'
    : seconds < 60
      ? `${seconds}s`
      : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;

export default function Dashboard() {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{
    message: string;
    expired: boolean;
  } | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await dashboardApi.overview());
    } catch (reason) {
      setError({
        message:
          reason instanceof Error
            ? reason.message
            : 'The dashboard could not be loaded.',
        expired: reason instanceof DashboardApiError && reason.status === 401,
      });
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  if (loading)
    return (
      <div aria-label="Loading dashboard" className="space-y-6">
        {[1, 2, 3].map((item) => (
          <div key={item} className="bg-muted h-32 animate-pulse rounded-xl" />
        ))}
      </div>
    );
  if (error)
    return (
      <section className="card p-8 text-center">
        <h1 className="text-xl font-semibold">
          {error.expired ? 'Your session has expired' : 'Dashboard unavailable'}
        </h1>
        <p className="text-muted-foreground mt-2">{error.message}</p>
        <div className="mt-5 flex justify-center gap-3">
          {error.expired && (
            <Link
              className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm"
              href="/login"
            >
              Sign in
            </Link>
          )}
          <button
            className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm"
            onClick={() => void load()}
          >
            <RotateCw className="size-4" />
            Retry
          </button>
        </div>
      </section>
    );
  if (!data) return null;
  const metrics = data.metrics;
  const health = metrics.total_projects
    ? Math.round(
        ((metrics.total_projects - metrics.failed_websites) /
          metrics.total_projects) *
          100,
      )
    : null;
  return (
    <div className="space-y-8">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-muted-foreground text-sm">
            {new Intl.DateTimeFormat(undefined, { dateStyle: 'full' }).format(
              new Date(),
            )}
          </p>
          <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">
            Welcome back, {data.user.first_name}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Here is the latest persisted data for {data.organization.name}.
          </p>
        </div>
        <Link
          href="/dashboard/new"
          className="bg-primary text-primary-foreground inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium"
        >
          <FilePlus2 className="size-4" />
          Create website
        </Link>
      </section>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(
          [
            [
              'Total websites',
              String(metrics.total_projects),
              'All organization projects',
              Globe2,
            ],
            [
              'Live websites',
              String(metrics.live_websites),
              `${metrics.draft_websites} draft`,
              Zap,
            ],
            [
              'Visitor analytics',
              'Not available',
              'Analytics are not currently tracked',
              Globe2,
            ],
            [
              'Average generation time',
              duration(metrics.average_generation_seconds),
              `${metrics.generations_this_month} this month`,
              Clock3,
            ],
          ] as Array<[string, string, string, LucideIcon]>
        ).map(([label, value, note, Icon]) => (
          <div className="card p-5" key={String(label)}>
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground text-sm">{String(label)}</p>
              <span className="bg-primary/10 text-primary rounded-lg p-2">
                <Icon className="size-4" />
              </span>
            </div>
            <p className="mt-3 text-2xl font-semibold">{String(value)}</p>
            <p className="text-muted-foreground mt-1 text-xs">{String(note)}</p>
          </div>
        ))}
      </section>
      <section className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="card">
          <div className="flex items-center justify-between border-b p-5">
            <div>
              <h2 className="font-semibold">Recent projects</h2>
              <p className="text-muted-foreground text-sm">
                Most recently updated
              </p>
            </div>
            <Link
              href="/dashboard/projects"
              className="text-primary text-sm font-medium"
            >
              View all
            </Link>
          </div>
          {data.recent_projects.length ? (
            <div className="divide-y">
              {data.recent_projects.map((project) => (
                <Link
                  href={`/dashboard/projects/${project.id}`}
                  key={project.id}
                  className="flex items-center gap-3 p-4 sm:px-5"
                >
                  <span className="bg-primary text-primary-foreground grid size-10 place-items-center rounded-lg font-semibold">
                    {project.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {project.name}
                    </span>
                    <span className="text-muted-foreground block truncate text-xs">
                      {project.slug}
                    </span>
                  </span>
                  <span className="bg-muted rounded-full px-2.5 py-1 text-xs capitalize">
                    {project.status}
                  </span>
                  <span className="text-muted-foreground hidden text-xs md:block">
                    {dateTime(project.updated_at)}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <p className="font-medium">No websites yet</p>
              <p className="text-muted-foreground mt-1 text-sm">
                Create your first website to see it here.
              </p>
              <Link
                href="/dashboard/new"
                className="text-primary mt-3 inline-block text-sm font-medium"
              >
                Create Website
              </Link>
            </div>
          )}
        </div>
        <div className="card p-5">
          <h2 className="font-semibold">Website health</h2>
          <p className="text-muted-foreground text-sm">
            Derived from current project statuses
          </p>
          <p className="mt-8 text-center text-3xl font-semibold">
            {health === null ? 'No data yet' : `${health}%`}
          </p>
          <div className="mt-8 grid grid-cols-3 gap-2 text-center">
            {[
              [metrics.live_websites, 'Live'],
              [metrics.draft_websites, 'Draft'],
              [metrics.failed_websites, 'Failed'],
            ].map(([value, label]) => (
              <div key={label}>
                <p className="font-semibold">{value}</p>
                <p className="text-muted-foreground text-xs">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div className="card p-5">
          <h2 className="font-semibold">Recent deployments</h2>
          {data.recent_deployments.length ? (
            <div className="mt-5 space-y-4">
              {data.recent_deployments.map((deployment) => (
                <div className="flex items-center gap-3" key={deployment.id}>
                  <Rocket className="text-primary size-4" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {deployment.project_name}
                    </p>
                    <p className="text-muted-foreground text-xs capitalize">
                      {deployment.dry_run ? 'Preview' : 'Production'} ·{' '}
                      {deployment.status}
                    </p>
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {deployment.completed_at
                      ? dateTime(deployment.completed_at)
                      : 'In progress'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground py-10 text-center text-sm">
              No deployments yet
            </p>
          )}
        </div>
        <div className="card p-5">
          <h2 className="font-semibold">Activity</h2>
          {data.recent_activity.length ? (
            <div className="mt-5 space-y-4">
              {data.recent_activity.map((activity) => (
                <div key={activity.id}>
                  <p className="text-sm">{activity.description}</p>
                  <p className="text-muted-foreground text-xs">
                    {dateTime(activity.created_at)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground py-10 text-center text-sm">
              No recent activity
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
