import { ArrowRight, Search, Sparkles } from 'lucide-react';
import { PageHeading } from '@/components/page-heading';
import { templates } from '@/lib/mock-data';
export default function Templates() {
  return (
    <>
      <PageHeading
        title="Templates"
        description="Curated starting points, ready to make your own."
      />
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative max-w-md flex-1">
          <Search className="text-muted-foreground absolute left-3 top-2.5 size-4" />
          <input className="field py-2 pl-9" placeholder="Search templates" />
        </div>
        <div className="flex gap-2 overflow-auto">
          {['All', 'Business', 'Portfolio', 'E-commerce'].map((x, i) => (
            <button
              key={x}
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm ${i === 0 ? 'bg-foreground text-background' : 'bg-card border'}`}
            >
              {x}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {templates.map((t) => (
          <article className="card group overflow-hidden" key={t.name}>
            <div className={`h-52 p-6 ${t.color}`}>
              <div className="h-full rounded-lg border border-white/30 bg-white/15 p-4 shadow-xl backdrop-blur transition group-hover:-translate-y-1">
                <div className="flex justify-between">
                  <div className="h-2 w-16 rounded bg-white/80" />
                  <div className="flex gap-1">
                    <i className="size-1.5 rounded-full bg-white/50" />
                    <i className="size-1.5 rounded-full bg-white/50" />
                  </div>
                </div>
                <div className="mt-12 h-4 w-2/3 rounded bg-white/80" />
                <div className="mt-3 h-2 w-4/5 rounded bg-white/40" />
                <div className="mt-4 h-5 w-16 rounded bg-white/80" />
              </div>
            </div>
            <div className="flex items-center p-4">
              <div className="flex-1">
                <p className="font-medium">{t.name}</p>
                <p className="text-muted-foreground text-sm">{t.type}</p>
              </div>
              <button className="text-primary flex items-center gap-1.5 text-sm font-medium">
                Use template <ArrowRight className="size-4" />
              </button>
            </div>
          </article>
        ))}
      </div>
      <div className="card bg-primary/5 mt-8 flex flex-col items-center p-8 text-center">
        <Sparkles className="text-primary size-6" />
        <h2 className="mt-3 text-lg font-semibold">
          Can’t find the right starting point?
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Our AI can create a completely custom design for your business.
        </p>
      </div>
    </>
  );
}
