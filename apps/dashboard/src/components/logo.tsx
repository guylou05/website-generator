import { Sparkles } from 'lucide-react';

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 font-semibold tracking-tight">
      <span className="bg-primary text-primary-foreground shadow-primary/20 grid size-8 place-items-center rounded-lg shadow-lg">
        <Sparkles className="size-4" />
      </span>
      {!compact && <span>SiteFoundry</span>}
    </div>
  );
}
