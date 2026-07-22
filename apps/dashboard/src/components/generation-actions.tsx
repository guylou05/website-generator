'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { dashboardApi } from '@/lib/api-client';
export function GenerationActions({
  runId,
  retryable,
}: {
  runId: string | undefined;
  retryable: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const retry = async () => {
    if (!runId) return;
    setBusy(true);
    try {
      await dashboardApi.retryGeneration(runId);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex gap-3">
      <button
        disabled={!retryable || busy}
        onClick={retry}
        className="bg-primary text-primary-foreground flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-50"
      >
        <RotateCcw className="size-4" />
        Retry generation
      </button>
      <button
        disabled
        className="rounded-lg border px-4 py-2.5 text-sm font-medium disabled:opacity-50"
      >
        Prepare Deployment
      </button>
    </div>
  );
}
