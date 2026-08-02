'use client';

import { useMemo, useState } from 'react';
import type { DeploymentPlan } from '@/lib/api-client';

const resources = [
  'all',
  'page',
  'elementor',
  'media',
  'menu',
  'homepage',
  'seo',
  'css',
  'settings',
] as const;
const labels: Record<string, string> = {
  all: 'All changes',
  page: 'Pages',
  elementor: 'Elementor',
  media: 'Media',
  menu: 'Navigation',
  homepage: 'Homepage',
  seo: 'SEO',
  css: 'CSS',
  settings: 'Site settings',
};

function Value({
  value,
  empty = 'Not present',
}: {
  value: unknown;
  empty?: string;
}) {
  if (value === null || value === undefined)
    return <span className="italic text-slate-400">{empty}</span>;
  if (typeof value === 'string')
    return <span className="whitespace-pre-wrap">{value}</span>;
  return (
    <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function TextDiff({ before, after }: { before: unknown; after: unknown }) {
  if (
    typeof before !== 'string' ||
    typeof after !== 'string' ||
    before === after
  )
    return null;
  const oldWords = new Set(before.split(/\s+/));
  return (
    <p
      className="mt-3 rounded-md bg-slate-50 p-3 text-sm leading-6"
      aria-label="Inline text diff"
    >
      {after.split(/(\s+)/).map((word, index) =>
        oldWords.has(word) || /^\s+$/.test(word) ? (
          <span key={index}>{word}</span>
        ) : (
          <mark
            className="rounded bg-emerald-100 px-0.5 text-emerald-900"
            key={index}
          >
            {word}
          </mark>
        ),
      )}
    </p>
  );
}

export function RevisionViewer({ plan }: { plan: DeploymentPlan }) {
  const [query, setQuery] = useState('');
  const [resource, setResource] = useState<(typeof resources)[number]>('all');
  const [action, setAction] = useState('all');
  const visible = useMemo(
    () =>
      plan.changes.filter(
        (change) =>
          (resource === 'all' || change.resource === resource) &&
          (action === 'all' || change.action === action) &&
          `${change.label} ${change.identifier} ${change.reason}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [plan.changes, query, resource, action],
  );
  const changed = plan.changes.filter(
    (change) => change.action !== 'unchanged',
  ).length;

  return (
    <section
      className="card overflow-hidden"
      aria-labelledby="revision-viewer-title"
    >
      <header className="border-b bg-slate-950 p-5 text-white sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-sky-300">
              Read-only revision viewer
            </p>
            <h2
              id="revision-viewer-title"
              className="mt-1 text-2xl font-semibold"
            >
              Review every planned change
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              This saved comparison cannot modify WordPress. Review it before
              authorizing the immutable deployment artifact.
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${plan.safetyStatus === 'safe' ? 'bg-emerald-400/20 text-emerald-200' : plan.safetyStatus === 'warning' ? 'bg-amber-400/20 text-amber-200' : 'bg-red-400/20 text-red-200'}`}
          >
            {plan.safetyStatus === 'safe'
              ? '✓ Safe to proceed'
              : plan.safetyStatus === 'warning'
                ? '⚠ Review warnings'
                : '✕ Deployment blocked'}
          </span>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {[
            ['Planned', plan.statistics.total],
            ['Changed', changed],
            ['Create', plan.statistics.create ?? 0],
            ['Update', plan.statistics.update ?? 0],
            ['Unchanged', plan.statistics.unchanged ?? 0],
          ].map(([label, value]) => (
            <div className="rounded-lg bg-white/10 p-3" key={label}>
              <p className="text-xs text-slate-300">{label}</p>
              <p className="text-xl font-semibold">{value}</p>
            </div>
          ))}
        </div>
      </header>
      <div className="space-y-5 p-4 sm:p-6">
        {plan.warnings.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <h3 className="font-semibold text-amber-950">Safety warnings</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
              {plan.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
          <label className="sr-only" htmlFor="diff-search">
            Search planned changes
          </label>
          <input
            id="diff-search"
            className="rounded-lg border px-3 py-2"
            type="search"
            placeholder="Search pages, fields, or reasons…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <select
            aria-label="Filter by resource"
            className="rounded-lg border px-3 py-2"
            value={resource}
            onChange={(event) =>
              setResource(event.target.value as typeof resource)
            }
          >
            {resources.map((item) => (
              <option key={item} value={item}>
                {labels[item]}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by action"
            className="rounded-lg border px-3 py-2 capitalize"
            value={action}
            onChange={(event) => setAction(event.target.value)}
          >
            {[
              'all',
              'create',
              'update',
              'configure',
              'regenerate',
              'unchanged',
            ].map((item) => (
              <option key={item} value={item}>
                {item === 'all' ? 'All actions' : item}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Resource filters">
          {resources.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setResource(item)}
              className={`rounded-full border px-3 py-1.5 text-sm ${resource === item ? 'border-slate-950 bg-slate-950 text-white' : 'bg-white'}`}
            >
              {labels[item]}{' '}
              <span className="opacity-60">
                {item === 'all'
                  ? plan.changes.length
                  : plan.changes.filter((x) => x.resource === item).length}
              </span>
            </button>
          ))}
        </div>
        <p className="text-sm text-slate-500" role="status">
          Showing {visible.length} of {plan.changes.length} comparisons
        </p>
        <div className="space-y-3">
          {visible.map((change, index) => (
            <details
              className="group rounded-xl border bg-white"
              key={`${change.resource}-${change.identifier}-${index}`}
              open={visible.length <= 4}
            >
              <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
                <span
                  className={`rounded-md px-2 py-1 text-xs font-semibold uppercase ${change.action === 'unchanged' ? 'bg-slate-100 text-slate-600' : change.action === 'create' ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'}`}
                >
                  {change.action}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{change.label}</p>
                  <p className="truncate text-sm text-slate-500">
                    {labels[change.resource] ?? change.resource} ·{' '}
                    {change.identifier}
                  </p>
                </div>
                <span className="text-slate-400 group-open:rotate-180">⌄</span>
              </summary>
              <div className="border-t p-4">
                <p className="mb-4 text-sm text-slate-600">{change.reason}</p>
                {change.resource === 'media' && (
                  <p className="mb-3 w-fit rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-violet-800">
                    Decision:{' '}
                    {String(
                      change.details?.decision ??
                        (change.action === 'unchanged' ? 'reuse' : 'upload'),
                    )}
                  </p>
                )}
                <div className="grid overflow-hidden rounded-lg border md:grid-cols-2">
                  <div className="min-w-0 bg-red-50/40 p-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-700">
                      Current WordPress
                    </p>
                    <Value value={change.before} />
                  </div>
                  <div className="min-w-0 border-t bg-emerald-50/40 p-4 md:border-l md:border-t-0">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                      Planned revision
                    </p>
                    <Value value={change.after} />
                  </div>
                </div>
                <TextDiff before={change.before} after={change.after} />
              </div>
            </details>
          ))}
        </div>
        {visible.length === 0 && (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-slate-500">
            No planned changes match these filters.
          </div>
        )}
        <footer className="flex flex-wrap justify-between gap-2 border-t pt-4 text-xs text-slate-500">
          <span>Plan saved {new Date(plan.createdAt).toLocaleString()}</span>
          <span>
            Estimated future deployment: {plan.estimatedSeconds}s · No writes
            performed
          </span>
        </footer>
      </div>
    </section>
  );
}
