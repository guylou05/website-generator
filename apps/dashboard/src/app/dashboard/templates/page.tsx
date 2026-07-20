import { PageHeader } from '@/components/dashboard/page-header';
import { ArrowUpRight, Search, Sparkles } from 'lucide-react';
const templates = [
  [
    'SaaS Launch',
    'Conversion-focused landing system for software companies.',
    'SaaS',
    'violet',
  ],
  [
    'Studio Portfolio',
    'Editorial layouts for creative teams and independent studios.',
    'Portfolio',
    'rose',
  ],
  [
    'Expert Services',
    'Trust-building pages for consultancies and specialists.',
    'Services',
    'blue',
  ],
  [
    'Local Essential',
    'A polished local business site with booking-ready pages.',
    'Business',
    'amber',
  ],
  [
    'Product Journal',
    'A content-led storefront for modern product brands.',
    'Commerce',
    'green',
  ],
  [
    'Empty canvas',
    'Start from your own direction with AI-assisted structure.',
    'Blank',
    'slate',
  ],
];
export default function Templates() {
  return (
    <>
      <PageHeader
        eyebrow="Curated library"
        title="Templates"
        description="Thoughtful foundations, ready to adapt to your brand."
      />
      <div className="template-toolbar">
        <div className="field-search">
          <Search size={16} />
          <span>Search templates</span>
        </div>
        <div className="category-tabs">
          <button className="active">All</button>
          <button>SaaS</button>
          <button>Services</button>
          <button>Portfolio</button>
        </div>
      </div>
      <div className="templates-grid">
        {templates.map(([name, desc, category, color], i) => (
          <article className="library-card" key={name}>
            <div className={`library-preview library-${color}`}>
              <div className="preview-nav">
                <i />
                <span />
                <span />
                <b />
              </div>
              <div className="preview-hero">
                <small>{category}</small>
                <strong />
                <span />
                <span />
                <button />
              </div>
              {i === 5 && <Sparkles className="canvas-spark" />}
            </div>
            <div className="library-copy">
              <div>
                <span>{category}</span>
                <h2>{name}</h2>
                <p>{desc}</p>
              </div>
              <button className="icon-button">
                <ArrowUpRight size={16} />
              </button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
