'use client';
import { useState } from 'react';
import { RotateCcw, XCircle } from 'lucide-react';
import { dashboardApi, type GenerationRun } from '@/lib/api-client';
import {
  canCancelGeneration,
  canRetryGeneration,
} from '@/lib/generation-controls';

export function GenerationActions({
  run,
  onGenerationChange,
}: {
  run: GenerationRun | undefined;
  onGenerationChange: (run: GenerationRun) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const retry = async () => {
    if (!run) return;
    setBusy(true);
    setError('');
    try {
      onGenerationChange(await dashboardApi.retryGeneration(run.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Retry failed.');
    } finally {
      setBusy(false);
    }
  };
  const cancel = async () => {
    if (!run || run.status === 'cancelling') return;
    setBusy(true);
    setError('');
    try {
      onGenerationChange(await dashboardApi.cancelGeneration(run.id));
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Cancellation failed.',
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        disabled={!run || !canRetryGeneration(run.status) || busy}
        onClick={retry}
        className="bg-primary text-primary-foreground flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-50"
      >
        <RotateCcw className="size-4" />
        Retry generation
      </button>
      {run && canCancelGeneration(run.status) && (
        <button
          disabled={busy || run.status === 'cancelling'}
          onClick={cancel}
          className="flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium disabled:opacity-50"
        >
          <XCircle className="size-4" />
          Cancel generation
        </button>
      )}
      {error && <p className="w-full text-sm text-red-700">{error}</p>}
    </div>
  );
}
