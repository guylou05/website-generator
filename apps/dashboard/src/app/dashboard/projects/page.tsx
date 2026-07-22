import Link from 'next/link';
import { FilePlus2 } from 'lucide-react';
import { PageHeading } from '@/components/page-heading';
import { dashboardApi, type Project } from '@/lib/api-client';

export default async function Projects() {
  let projects: Project[] = [];
  let unavailable = false;
  try {
    projects = await dashboardApi.projects();
  } catch {
    unavailable = true;
  }
  return (
    <>
      <PageHeading
        title="Projects"
        description="Manage your generated websites."
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
      <div className="card divide-y">
        {unavailable && (
          <p className="p-6 text-sm text-red-600">
            Projects could not be loaded. Check the API connection.
          </p>
        )}
        {!unavailable && projects.length === 0 && (
          <p className="text-muted-foreground p-8 text-center text-sm">
            No projects yet. Create your first website.
          </p>
        )}
        {projects.map((project) => (
          <Link
            href={`/dashboard/projects/${project.id}`}
            key={project.id}
            className="hover:bg-muted/50 flex items-center gap-4 p-4 sm:px-6"
          >
            <div className="bg-primary grid size-11 place-items-center rounded-xl font-semibold text-white">
              {project.name[0]}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{project.name}</p>
              <p className="text-muted-foreground truncate text-sm">
                {project.slug}
              </p>
            </div>
            <span className="bg-muted rounded-full px-2.5 py-1 text-xs capitalize">
              {project.status}
            </span>
            <span className="text-muted-foreground hidden text-xs md:block">
              {new Date(project.updatedAt).toLocaleDateString()}
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}
