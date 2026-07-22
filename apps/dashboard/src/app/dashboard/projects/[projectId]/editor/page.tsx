'use client';
import { useEffect, useReducer, useState } from 'react';
import {
  ChevronDown,
  Eye,
  History,
  Laptop,
  Redo2,
  Save,
  Smartphone,
  Tablet,
  Undo2,
} from 'lucide-react';

type Device = 'desktop' | 'tablet' | 'mobile';
const widths: Record<Device, string> = {
  desktop: '100%',
  tablet: '768px',
  mobile: '390px',
};
type State = { past: string[]; value: string; future: string[] };
function reducer(
  s: State,
  a: { type: 'edit'; value?: string } | { type: 'undo' | 'redo' },
): State {
  if (a.type === 'edit')
    return { past: [...s.past, s.value], value: a.value ?? '', future: [] };
  if (a.type === 'undo' && s.past.length)
    return {
      past: s.past.slice(0, -1),
      value: s.past.at(-1)!,
      future: [s.value, ...s.future],
    };
  if (a.type === 'redo' && s.future.length)
    return {
      past: [...s.past, s.value],
      value: s.future[0]!,
      future: s.future.slice(1),
    };
  return s;
}
export default function EditorPage() {
  const [device, setDevice] = useState<Device>('desktop');
  const [selected, setSelected] = useState('Hero');
  const [state, dispatch] = useReducer(reducer, {
    past: [],
    value: 'Build a website your customers will trust',
    future: [],
  });
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  return (
    <div className="-m-6 flex h-[calc(100vh-4rem)] flex-col bg-slate-100">
      <header className="flex h-14 items-center gap-2 border-b bg-white px-4">
        <button className="rounded-lg border px-3 py-2 text-sm font-medium">
          Revision 4 <ChevronDown className="inline h-4 w-4" />
        </button>
        <span className="mr-auto text-xs font-medium text-emerald-700">
          {dirty ? 'Unsaved changes' : 'All changes saved'}
        </span>
        <button
          aria-label="Undo"
          disabled={!state.past.length}
          onClick={() => dispatch({ type: 'undo' })}
          className="rounded p-2 disabled:opacity-30"
        >
          <Undo2 className="h-4 w-4" />
        </button>
        <button
          aria-label="Redo"
          disabled={!state.future.length}
          onClick={() => dispatch({ type: 'redo' })}
          className="rounded p-2 disabled:opacity-30"
        >
          <Redo2 className="h-4 w-4" />
        </button>
        {(['desktop', 'tablet', 'mobile'] as Device[]).map((d) => {
          const Icon =
            d === 'desktop' ? Laptop : d === 'tablet' ? Tablet : Smartphone;
          return (
            <button
              key={d}
              aria-label={`${d} preview`}
              aria-pressed={device === d}
              onClick={() => setDevice(d)}
              className={`rounded p-2 ${device === d ? 'bg-indigo-100 text-indigo-700' : ''}`}
            >
              <Icon className="h-4 w-4" />
            </button>
          );
        })}
        <button className="rounded-lg border px-3 py-2 text-sm">
          <History className="mr-1 inline h-4 w-4" />
          Compare
        </button>
        <button className="rounded-lg border px-3 py-2 text-sm">
          <Eye className="mr-1 inline h-4 w-4" />
          Preview
        </button>
        <button
          onClick={() => setDirty(false)}
          className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white"
        >
          <Save className="mr-1 inline h-4 w-4" />
          Save
        </button>
        <button className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">
          Approve
        </button>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-[240px_1fr_288px]">
        <aside className="overflow-auto border-r bg-white p-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">
            Pages
          </p>
          {['Home', 'About', 'Services', 'Contact'].map((p, i) => (
            <button
              key={p}
              className={`mb-1 w-full rounded-lg px-3 py-2 text-left text-sm ${i === 0 ? 'bg-indigo-50 font-semibold text-indigo-700' : 'hover:bg-slate-50'}`}
            >
              {p}
            </button>
          ))}
          <p className="mb-2 mt-6 text-xs font-bold uppercase tracking-wide text-slate-500">
            Page structure
          </p>
          {[
            'Header',
            'Hero',
            'Services grid',
            'Testimonials',
            'CTA',
            'Footer',
          ].map((p) => (
            <button
              onClick={() => setSelected(p)}
              key={p}
              className={`mb-1 w-full rounded-lg border px-3 py-2 text-left text-sm focus:ring-2 focus:ring-indigo-500 ${selected === p ? 'border-indigo-500 bg-indigo-50' : ''}`}
            >
              {p}
            </button>
          ))}
        </aside>
        <main className="overflow-auto p-6">
          <div
            style={{ maxWidth: widths[device] }}
            className="mx-auto min-h-full overflow-hidden rounded-xl border bg-white shadow-xl transition-[max-width]"
          >
            <nav className="flex items-center justify-between px-8 py-5">
              <strong>Northstar Studio</strong>
              <span className="text-sm">Home · Services · About · Contact</span>
            </nav>
            <section
              onClick={() => setSelected('Hero')}
              className={`cursor-pointer px-10 py-24 text-center outline-offset-[-3px] ${selected === 'Hero' ? 'outline outline-2 outline-indigo-500' : ''}`}
            >
              <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                Thoughtful websites, built faster
              </span>
              <h1 className="mx-auto mt-5 max-w-3xl text-5xl font-bold tracking-tight">
                {state.value}
              </h1>
              <p className="mx-auto mt-5 max-w-xl text-slate-600">
                A polished digital presence designed around your business and
                ready for WordPress.
              </p>
              <button className="mt-8 rounded-lg bg-indigo-600 px-5 py-3 font-semibold text-white">
                Start a project
              </button>
            </section>
            <section className="bg-slate-50 px-8 py-16">
              <h2 className="text-center text-3xl font-bold">
                Everything you need to stand out
              </h2>
              <div className="mt-8 grid grid-cols-3 gap-4">
                {['Strategy first', 'Built to convert', 'Easy to manage'].map(
                  (x) => (
                    <div className="rounded-xl bg-white p-5 shadow-sm" key={x}>
                      <strong>{x}</strong>
                      <p className="mt-2 text-sm text-slate-500">
                        Focused content and accessible design for a trustworthy
                        customer experience.
                      </p>
                    </div>
                  ),
                )}
              </div>
            </section>
          </div>
        </main>
        <aside className="overflow-auto border-l bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Selected element
          </p>
          <h2 className="mt-1 text-lg font-semibold">{selected}</h2>
          <label className="mt-6 block text-sm font-medium" htmlFor="headline">
            Headline
          </label>
          <textarea
            id="headline"
            className="field mt-2 min-h-28"
            value={state.value}
            onChange={(e) => {
              dispatch({ type: 'edit', value: e.target.value });
              setDirty(true);
            }}
          />
          <p className="mt-2 text-xs text-slate-500">
            Plain text only. 120 characters maximum.
          </p>
          <label className="mt-5 block text-sm font-medium" htmlFor="alignment">
            Alignment
          </label>
          <select id="alignment" className="field mt-2">
            <option>Center</option>
            <option>Left</option>
          </select>
          <button className="mt-6 w-full rounded-lg border border-indigo-200 px-3 py-2 text-sm font-semibold text-indigo-700">
            Rewrite with AI
          </button>
        </aside>
      </div>
    </div>
  );
}
