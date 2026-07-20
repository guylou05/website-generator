import { PageHeader } from '@/components/dashboard/page-header';
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Globe2,
  LayoutTemplate,
  Plus,
  Rocket,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';

const projects = [
  {
    name: 'Northstar Studio',
    domain: 'northstar.design',
    status: 'Live',
    color: 'violet',
    updated: '12 min ago',
  },
  {
    name: 'Marrow Health',
    domain: 'preview.marrow.health',
    status: 'Building',
    color: 'cyan',
    updated: '1 hr ago',
  },
  {
    name: 'Arc Finance',
    domain: 'arc-finance.co',
    status: 'Draft',
    color: 'amber',
    updated: 'Yesterday',
  },
];
const deployments = [
  {
    project: 'Northstar Studio',
    branch: 'Production',
    status: 'Ready',
    time: '12m',
    duration: '48s',
  },
  {
    project: 'Marrow Health',
    branch: 'Preview',
    status: 'Building',
    time: '1h',
    duration: '—',
  },
  {
    project: 'Arc Finance',
    branch: 'Production',
    status: 'Ready',
    time: '2d',
    duration: '1m 04s',
  },
];
export default function Dashboard() {
  return (
    <>
      <PageHeader
        eyebrow="Monday, July 20"
        title="Good morning, Alex"
        description="Here’s what’s happening across your websites."
        actions={
          <>
            <button className="button button-secondary">
              <Globe2 size={16} />
              View all sites
            </button>
            <Link href="/dashboard/new" className="button button-primary">
              <Plus size={16} />
              New website
            </Link>
          </>
        }
      />
      <section className="metric-grid">
        <div className="metric-card">
          <span className="metric-icon purple">
            <Globe2 />
          </span>
          <div>
            <p>Active websites</p>
            <strong>12</strong>
            <span className="metric-change">+2 this month</span>
          </div>
        </div>
        <div className="metric-card">
          <span className="metric-icon green">
            <CheckCircle2 />
          </span>
          <div>
            <p>Sites online</p>
            <strong>11</strong>
            <span className="muted-small">99.98% uptime</span>
          </div>
        </div>
        <div className="metric-card">
          <span className="metric-icon blue">
            <Rocket />
          </span>
          <div>
            <p>Deployments</p>
            <strong>48</strong>
            <span className="metric-change">+14% vs last month</span>
          </div>
        </div>
        <div className="metric-card">
          <span className="metric-icon amber">
            <Clock3 />
          </span>
          <div>
            <p>Generation time</p>
            <strong>4m 12s</strong>
            <span className="muted-small">Average this week</span>
          </div>
        </div>
      </section>
      <div className="dashboard-grid">
        <section className="card span-2">
          <div className="card-heading">
            <div>
              <h2>Recent projects</h2>
              <p>Your recently updated websites</p>
            </div>
            <Link href="/dashboard/projects">
              View all <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="project-list">
            {projects.map((p) => (
              <div className="project-row" key={p.name}>
                <span className={`project-logo ${p.color}`}>
                  {p.name.slice(0, 1)}
                </span>
                <div className="project-info">
                  <strong>{p.name}</strong>
                  <span>{p.domain}</span>
                </div>
                <span className={`status status-${p.status.toLowerCase()}`}>
                  <i />
                  {p.status}
                </span>
                <span className="row-time">{p.updated}</span>
                <button className="icon-button">
                  <ExternalLink size={15} />
                </button>
              </div>
            ))}
          </div>
        </section>
        <section className="card">
          <div className="card-heading">
            <div>
              <h2>Website status</h2>
              <p>Last 30 days</p>
            </div>
            <span className="status status-live">
              <i />
              Operational
            </span>
          </div>
          <div className="uptime">
            <strong>99.98%</strong>
            <span>Global uptime</span>
          </div>
          <div className="uptime-bars">
            {Array.from({ length: 30 }, (_, i) => (
              <i key={i} className={i === 19 ? 'warning' : ''} />
            ))}
          </div>
          <div className="status-foot">
            <span>30 days ago</span>
            <span>Today</span>
          </div>
          <div className="divider" />
          <div className="region-row">
            <span>
              <i className="region-dot" />
              WordPress API
            </span>
            <b>Operational</b>
          </div>
          <div className="region-row">
            <span>
              <i className="region-dot" />
              Generator queue
            </span>
            <b>Operational</b>
          </div>
        </section>
        <section className="card span-2">
          <div className="card-heading">
            <div>
              <h2>Recent deployments</h2>
              <p>Latest production and preview builds</p>
            </div>
            <button className="button button-ghost">Deployment logs</button>
          </div>
          <div className="deployment-list">
            {deployments.map((d) => (
              <div className="deployment-row" key={d.project}>
                <span className="deploy-icon">
                  <Rocket size={15} />
                </span>
                <div>
                  <strong>{d.project}</strong>
                  <span>{d.branch}</span>
                </div>
                <span className={`status status-${d.status.toLowerCase()}`}>
                  <i />
                  {d.status}
                </span>
                <span>{d.duration}</span>
                <span className="row-time">{d.time} ago</span>
              </div>
            ))}
          </div>
        </section>
        <section className="card">
          <div className="card-heading">
            <div>
              <h2>Templates</h2>
              <p>Start with a proven foundation</p>
            </div>
            <Link href="/dashboard/templates">
              <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="template-stack">
            <div className="template-preview preview-one">
              <div />
              <span />
              <span />
            </div>
            <div className="template-meta">
              <span className="template-icon">
                <LayoutTemplate size={15} />
              </span>
              <div>
                <strong>SaaS Launch</strong>
                <span>Marketing · 8 pages</span>
              </div>
            </div>
            <div className="template-preview preview-two">
              <div />
              <span />
              <span />
            </div>
            <div className="template-meta">
              <span className="template-icon">
                <Sparkles size={15} />
              </span>
              <div>
                <strong>Studio Portfolio</strong>
                <span>Creative · 6 pages</span>
              </div>
            </div>
          </div>
        </section>
        <section className="card full-span">
          <div className="card-heading">
            <div>
              <h2>Activity</h2>
              <p>Latest events across your workspace</p>
            </div>
          </div>
          <div className="activity-line">
            <span className="activity-icon">
              <Activity size={15} />
            </span>
            <div>
              <strong>You published Northstar Studio</strong>
              <p>Production deployment completed successfully</p>
            </div>
            <time>12 minutes ago</time>
          </div>
        </section>
      </div>
    </>
  );
}
