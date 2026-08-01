'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Loader2,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import { dashboardApi, type GenerationRun } from '@/lib/api-client';

const terminal = new Set([
  'completed',
  'succeeded',
  'failed',
  'cancelled',
  'stale',
]);

export default function GenerationProgressPage() {
  const { projectId, generationId } = useParams<{
    projectId: string;
    generationId: string;
  }>();
  const router = useRouter();
  const [run, setRun] = useState<GenerationRun>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      setRun(await dashboardApi.generation(generationId));
      setError('');
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Generation progress is unavailable.',
      );
    }
  }, [generationId]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!run || terminal.has(run.status)) return;
    const timer = window.setInterval(() => void load(), 2500);
    return () => window.clearInterval(timer);
  }, [load, run]);
  useEffect(() => {
    if (run && ['completed', 'succeeded'].includes(run.status)) {
      const timer = window.setTimeout(
        () => router.push(`/dashboard/projects/${projectId}`),
        1200,
      );
      return () => window.clearTimeout(timer);
    }
  }, [projectId, router, run]);

  const act = async (action: 'retry' | 'cancel') => {
    setBusy(true);
    setError('');
    try {
      const next =
        action === 'retry'
          ? await dashboardApi.retryGeneration(generationId)
          : await dashboardApi.cancelGeneration(generationId);
      if (action === 'retry' && next.id !== generationId)
        router.replace(
          `/dashboard/projects/${projectId}/generations/${next.id}`,
        );
      else setRun(next);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : `Could not ${action} generation.`,
      );
    } finally {
      setBusy(false);
    }
  };

  const events = run?.events ?? [];
  const completed = events.filter(
    (event) => event.eventType === 'completed' || event.progress === 100,
  );
  return (
    <div className="mx-auto max-w-3xl" aria-live="polite">
      <p className="text-primary text-sm font-medium">Website generation</p>
      <h1 className="mt-1 text-2xl font-semibold">
        {run ? statusTitle(run.status) : 'Connecting to generation worker…'}
      </h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Progress is read from persisted worker events and reconnects
        automatically.
      </p>
      <section className="card mt-8 p-6 sm:p-8">
        {!run && !error && (
          <div className="flex items-center gap-3">
            <Loader2 className="size-5 animate-spin" /> Loading progress…
          </div>
        )}
        {run && (
          <>
            <div className="flex items-end justify-between">
              <div>
                <p className="font-medium capitalize">
                  {run.currentStage?.replaceAll('_', ' ') || run.status}
                </p>
                <p className="text-muted-foreground text-xs">
                  {completed.length} persisted stages completed
                </p>
              </div>
              <strong className="text-2xl">{run.progress}%</strong>
            </div>
            <div className="bg-muted mt-4 h-2 overflow-hidden rounded-full">
              <div
                className="bg-primary h-full transition-all"
                style={{ width: `${run.progress}%` }}
              />
            </div>
            {['pending', 'queued'].includes(run.status) && (
              <p className="mt-4 flex gap-2 text-sm text-amber-700">
                <AlertTriangle className="size-5 shrink-0" />
                The job is queued. Longer waits can mean that workers are busy
                or unavailable; it is safe to refresh.
              </p>
            )}
            {run.status === 'cancelling' && (
              <p className="mt-4 flex gap-2 text-sm text-amber-700">
                <AlertTriangle className="size-5 shrink-0" />
                Cancellation requested. The job will stop when the worker next
                checks its status.
              </p>
            )}
            <ol className="mt-6 space-y-2">
              {events.length ? (
                events.map((event) => (
                  <li
                    className="bg-muted/50 flex gap-3 rounded-lg p-3"
                    key={event.id}
                  >
                    {event.eventType === 'failed' ? (
                      <XCircle className="size-5 text-red-600" />
                    ) : event.eventType === 'completed' ? (
                      <CheckCircle2 className="size-5 text-emerald-600" />
                    ) : (
                      <Circle className="text-primary size-5" />
                    )}
                    <div>
                      <p className="text-sm font-medium capitalize">
                        {event.stage.replaceAll('_', ' ')}
                      </p>
                      {event.message && (
                        <p className="text-muted-foreground text-xs">
                          {event.message}
                        </p>
                      )}
                    </div>
                    <span className="text-muted-foreground ml-auto text-xs">
                      {event.progress ?? '—'}%
                    </span>
                  </li>
                ))
              ) : (
                <li className="text-muted-foreground text-sm">
                  Waiting for the first worker event…
                </li>
              )}
            </ol>
            {run.error && (
              <div
                role="alert"
                className="mt-5 rounded-lg bg-red-50 p-4 text-sm text-red-800"
              >
                <strong>Generation failed.</strong> {run.error.message}
              </div>
            )}
            <div className="mt-6 flex flex-wrap gap-3">
              {['failed', 'cancelled', 'stale'].includes(run.status) && (
                <button
                  disabled={busy}
                  onClick={() => void act('retry')}
                  className="bg-primary text-primary-foreground flex items-center gap-2 rounded-lg px-4 py-2 text-sm disabled:opacity-50"
                >
                  <RotateCcw className="size-4" />
                  Retry
                </button>
              )}
              {['pending', 'queued', 'running'].includes(run.status) && (
                <button
                  disabled={busy}
                  onClick={() => void act('cancel')}
                  className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50"
                >
                  Cancel generation
                </button>
              )}
              <Link
                href={`/dashboard/projects/${projectId}`}
                className="rounded-lg border px-4 py-2 text-sm"
              >
                View project
              </Link>
            </div>
          </>
        )}
        {error && (
          <div
            role="alert"
            className="mt-5 rounded-lg bg-red-50 p-4 text-sm text-red-800"
          >
            {error}{' '}
            <button onClick={() => void load()} className="ml-2 underline">
              Retry
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function statusTitle(status: GenerationRun['status']) {
  return {
    pending: 'Generation queued',
    queued: 'Generation queued',
    running: 'Creating your website',
    cancelling: 'Cancelling generation',
    completed: 'Website created',
    succeeded: 'Website created',
    failed: 'Generation failed',
    cancelled: 'Generation cancelled',
    stale: 'Generation worker stopped responding',
  }[status];
}
