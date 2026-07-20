'use client';
import { PageHeader } from '@/components/dashboard/page-header';
import {
  ArrowRight,
  BriefcaseBusiness,
  Check,
  Layers3,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';
const types = [
  {
    name: 'Marketing site',
    desc: 'Launch a polished product or company website.',
    icon: Sparkles,
  },
  {
    name: 'Services business',
    desc: 'Turn expertise into a clear, credible online presence.',
    icon: BriefcaseBusiness,
  },
  {
    name: 'Portfolio',
    desc: 'Showcase work with a modern editorial experience.',
    icon: Layers3,
  },
  {
    name: 'Online store',
    desc: 'Create a focused storefront for your products.',
    icon: ShoppingBag,
  },
];
export default function NewWebsite() {
  const [selected, setSelected] = useState(0);
  return (
    <div className="narrow-page">
      <PageHeader
        eyebrow="New project"
        title="What are you building?"
        description="Give us a little context. Foundry will shape the right structure, copy, and visual direction."
      />
      <div className="stepper">
        <span className="active">1</span>
        <i />
        <span>2</span>
        <i />
        <span>3</span>
        <p>Project type</p>
        <p>Brand details</p>
        <p>Generate</p>
      </div>
      <section className="card builder-card">
        <h2>Choose a starting point</h2>
        <p>Select the closest match. You can customize every detail later.</p>
        <div className="type-grid">
          {types.map((type, i) => (
            <button
              key={type.name}
              className={
                i === selected ? 'type-option selected' : 'type-option'
              }
              onClick={() => setSelected(i)}
            >
              <span className="type-icon">
                <type.icon size={20} />
              </span>
              <strong>{type.name}</strong>
              <p>{type.desc}</p>
              {i === selected && (
                <span className="check">
                  <Check size={13} />
                </span>
              )}
            </button>
          ))}
        </div>
        <label className="prompt-label">
          Describe your idea <span>Optional</span>
          <textarea placeholder="A calm, premium website for a financial planning studio that works with creative founders…" />
          <small>
            Use a sentence or two. The details can evolve as you build.
          </small>
        </label>
        <div className="builder-footer">
          <LinkBack />
          <button className="button button-primary">
            Continue <ArrowRight size={16} />
          </button>
        </div>
      </section>
    </div>
  );
}
function LinkBack() {
  return (
    <a href="/dashboard" className="button button-ghost">
      Cancel
    </a>
  );
}
