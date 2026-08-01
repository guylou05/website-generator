import type { GenerationRun } from './api-client';

export const canCancelGeneration = (status: GenerationRun['status']) =>
  ['queued', 'running', 'cancelling'].includes(status);

export const canRetryGeneration = (status: GenerationRun['status']) =>
  ['failed', 'cancelled', 'stale'].includes(status);
