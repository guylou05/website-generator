import Link from 'next/link';
import { ExternalLink, FilePlus2, MoreHorizontal, Search } from 'lucide-react';
import { PageHeading } from '@/components/page-heading';
import { projects } from '@/lib/mock-data';
export default function Projects() {
  return (
    <>
      <PageHeading
        title="Projects"
        description="Manage, edit, and publish all your websites."
        action={
          <Link
            href="/dashboard/new"
            className="bg-primary text-primary-foreground flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium"
          >
            <FilePlus2 className="size-4" />
            New website
          </Link>
        }
      />
      <div className="card">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="text-muted-foreground absolute left-3 top-2.5 size-4" />
            <input className="field py-2 pl-9" placeholder="Search projects" />
          </div>
          <select className="field w-auto py-2">
            <option>All statuses</option>
            <option>Live</option>
            <option>Draft</option>
          </select>
        </div>
        <div className="divide-y">
          {[
            ...projects,
            ...projects.slice(0, 2).map((p, i) => ({
              ...p,
              name: i ? 'Onda Coffee' : 'Orbit Legal',
              domain: i ? 'ondacoffee.com' : 'Preview ready',
            })),
          ].map((p, i) => (
            <div
              key={`${p.name}-${i}`}
              className="flex items-center gap-4 p-4 sm:px-6"
            >
              <div
                className={`grid size-11 place-items-center rounded-xl bg-gradient-to-br ${p.color} font-semibold text-white`}
              >
                {p.name[0]}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{p.name}</p>
                <p className="text-muted-foreground truncate text-sm">
                  {p.domain}
                </p>
              </div>
              <span
                className={`hidden rounded-full px-2.5 py-1 text-xs sm:block ${p.status === 'Live' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'}`}
              >
                {p.status}
              </span>
              <span className="text-muted-foreground hidden w-24 text-right text-xs md:block">
                {p.updated}
              </span>
              <ExternalLink className="text-muted-foreground size-4" />
              <MoreHorizontal className="text-muted-foreground size-4" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
