import { PageHeader } from '@/components/dashboard/page-header';
import {
  ExternalLink,
  Filter,
  MoreHorizontal,
  Plus,
  Search,
} from 'lucide-react';
import Link from 'next/link';
const projects = [
  ['Northstar Studio', 'northstar.design', 'Live', '12 min ago', 'violet'],
  ['Marrow Health', 'preview.marrow.health', 'Building', '1 hour ago', 'cyan'],
  ['Arc Finance', 'arc-finance.co', 'Draft', 'Yesterday', 'amber'],
  ['Élan Interiors', 'elan-interiors.com', 'Live', '3 days ago', 'rose'],
  ['Porter & Finch', 'porterfinch.co', 'Live', '6 days ago', 'blue'],
  ['Monument Coffee', 'preview.monument.cafe', 'Draft', '1 week ago', 'green'],
] as const;
export default function Projects() {
  return (
    <>
      <PageHeader
        title="Projects"
        description="Create, manage, and deploy your generated websites."
        actions={
          <Link href="/dashboard/new" className="button button-primary">
            <Plus size={16} />
            New website
          </Link>
        }
      />
      <div className="toolbar">
        <div className="field-search">
          <Search size={16} />
          <span>Search projects</span>
        </div>
        <button className="button button-secondary">
          <Filter size={15} />
          Filter
        </button>
      </div>
      <div className="projects-grid">
        {projects.map(([name, domain, status, time, color]) => (
          <article className="project-card" key={name}>
            <div className={`site-thumbnail thumb-${color}`}>
              <div className="mini-browser">
                <i />
                <i />
                <i />
              </div>
              <div className="mini-page">
                <span />
                <b />
                <em />
                <em />
              </div>
            </div>
            <div className="project-card-body">
              <div className="project-title">
                <span className={`project-logo ${color}`}>{name[0]}</span>
                <div>
                  <h2>{name}</h2>
                  <p>{domain}</p>
                </div>
                <button className="icon-button">
                  <MoreHorizontal size={17} />
                </button>
              </div>
              <div className="project-card-foot">
                <span className={`status status-${status.toLowerCase()}`}>
                  <i />
                  {status}
                </span>
                <span>{time}</span>
                <ExternalLink size={14} />
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
