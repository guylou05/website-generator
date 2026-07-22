import Link from 'next/link';
import {
  ArrowRight,
  Check,
  Clock3,
  ExternalLink,
  FilePlus2,
  Globe2,
  MoreHorizontal,
  Sparkles,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { templates } from '@/lib/mock-data';
import { dashboardApi, type Project } from '@/lib/api-client';

export default async function Dashboard() {
  let projects: Project[] = [];
  try {
    projects = await dashboardApi.projects();
  } catch {
    /* The projects page exposes connection errors. */
  }
  return (
    <div className="space-y-8">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-muted-foreground text-sm">Wednesday, July 22</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            Welcome back, Alex
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Here’s what’s happening with your websites.
          </p>
        </div>
        <Link
          href="/dashboard/new"
          className="bg-primary text-primary-foreground shadow-primary/20 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg"
        >
          <FilePlus2 className="size-4" />
          Create website
        </Link>
      </section>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: 'Total websites',
            value: String(projects.length),
            note: '+2 this month',
            Icon: Globe2,
          },
          {
            label: 'Live websites',
            value: '8',
            note: 'All systems operational',
            Icon: Zap,
          },
          {
            label: 'Total visitors',
            value: '24.8K',
            note: '+12.4% from last month',
            Icon: TrendingUp,
          },
          {
            label: 'Generation time',
            value: '4m 18s',
            note: '18s faster than average',
            Icon: Clock3,
          },
        ].map(({ label, value, note, Icon }) => (
          <div className="card p-5" key={label}>
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground text-sm">{label}</p>
              <span className="bg-primary/10 text-primary rounded-lg p-2">
                <Icon className="size-4" />
              </span>
            </div>
            <p className="mt-3 text-2xl font-semibold">{value}</p>
            <p className="text-muted-foreground mt-1 text-xs">{note}</p>
          </div>
        ))}
      </section>
      <section className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="card">
          <div className="flex items-center justify-between border-b p-5">
            <div>
              <h2 className="font-semibold">Recent projects</h2>
              <p className="text-muted-foreground text-sm">
                Your most recently edited websites
              </p>
            </div>
            <Link
              href="/dashboard/projects"
              className="text-primary text-sm font-medium"
            >
              View all
            </Link>
          </div>
          <div className="divide-y">
            {projects.slice(0, 3).map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-4 sm:px-5">
                <div
                  className={`grid size-10 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 text-sm font-bold text-white`}
                >
                  {p.name[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {p.slug}
                  </p>
                </div>
                <span
                  className={`hidden rounded-full px-2.5 py-1 text-xs sm:block ${p.status === 'ready' ? 'bg-emerald-500/10 text-emerald-600' : p.status === 'generating' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}
                >
                  {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                </span>
                <span className="text-muted-foreground hidden text-xs md:block">
                  {new Date(p.updatedAt).toLocaleDateString()}
                </span>
                <MoreHorizontal className="text-muted-foreground size-4" />
              </div>
            ))}
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Website status</h2>
              <p className="text-muted-foreground text-sm">
                Across all projects
              </p>
            </div>
            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
              <span className="size-2 rounded-full bg-emerald-500" />
              Operational
            </span>
          </div>
          <div className="mt-7 grid place-items-center">
            <div className="relative grid size-36 place-items-center rounded-full bg-[conic-gradient(hsl(var(--primary))_0_76%,hsl(var(--muted))_76%)]">
              <div className="bg-card grid size-28 place-items-center rounded-full text-center">
                <div>
                  <p className="text-3xl font-semibold">92%</p>
                  <p className="text-muted-foreground text-xs">Healthy</p>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-7 grid grid-cols-3 gap-2 text-center">
            {[
              ['8', 'Live'],
              ['3', 'Draft'],
              ['1', 'Paused'],
            ].map((x) => (
              <div key={x[1]}>
                <p className="font-semibold">{x[0]}</p>
                <p className="text-muted-foreground text-xs">{x[1]}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Recent deployments</h2>
            <span className="text-muted-foreground text-xs">Last 7 days</span>
          </div>
          <div className="mt-5 space-y-5">
            {[
              ['Northstar Health', 'Production', '2 minutes ago'],
              ['Kanso Interiors', 'Production', 'Yesterday'],
              ['Atlas Finance', 'Preview', '2 days ago'],
            ].map((x) => (
              <div className="flex items-center gap-3" key={x[0]}>
                <span className="grid size-7 place-items-center rounded-full bg-emerald-500/10 text-emerald-600">
                  <Check className="size-3.5" />
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium">{x[0]}</p>
                  <p className="text-muted-foreground text-xs">
                    Deployed to {x[1]}
                  </p>
                </div>
                <span className="text-muted-foreground text-xs">{x[2]}</span>
                <ExternalLink className="text-muted-foreground size-3.5" />
              </div>
            ))}
          </div>
        </div>
        <div className="card p-5">
          <h2 className="font-semibold">Activity</h2>
          <div className="mt-5 space-y-5">
            {[
              ['You published Northstar Health', '12 min ago'],
              ['AI generation completed for Flora Studio', '28 min ago'],
              ['You invited Jamie to Atlas Finance', 'Yesterday'],
            ].map((x, i) => (
              <div key={x[0]} className="flex gap-3">
                <span
                  className={`mt-1 size-2 rounded-full ${i === 1 ? 'bg-violet-500' : 'bg-sky-500'}`}
                />
                <div>
                  <p className="text-sm">{x[0]}</p>
                  <p className="text-muted-foreground text-xs">{x[1]}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="font-semibold">Popular templates</h2>
            <p className="text-muted-foreground text-sm">
              Start with a proven foundation
            </p>
          </div>
          <Link
            href="/dashboard/templates"
            className="text-primary flex items-center gap-1 text-sm font-medium"
          >
            Explore all <ArrowRight className="size-4" />
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.slice(0, 3).map((t) => (
            <div className="card overflow-hidden" key={t.name}>
              <div className={`h-36 p-5 ${t.color}`}>
                <div className="h-full rounded-md border border-white/30 bg-white/15 p-3 backdrop-blur">
                  <div className="h-2 w-16 rounded bg-white/80" />
                  <div className="mt-7 h-3 w-2/3 rounded bg-white/80" />
                  <div className="mt-2 h-2 w-1/2 rounded bg-white/40" />
                </div>
              </div>
              <div className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="text-muted-foreground text-xs">{t.type}</p>
                </div>
                <Sparkles className="text-primary size-4" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
