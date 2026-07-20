import {
  PipelineAbortedError,
  PipelineConfigurationError,
  PipelineStageError,
} from './errors.js';
import type { PipelineLogger } from './logger.js';
import { stageLogContext } from './logger.js';
import type { PipelineStage } from './contracts.js';

export interface RetryPolicy {
  readonly maxAttempts: number;
  delayMs(attempt: number, error: unknown): number;
  shouldRetry(error: unknown, attempt: number): boolean;
}

export interface Sleeper {
  sleep(milliseconds: number, signal?: AbortSignal): Promise<void>;
}

export class ExponentialBackoffRetryPolicy implements RetryPolicy {
  constructor(
    readonly maxAttempts = 3,
    private readonly initialDelayMs = 250,
    private readonly maximumDelayMs = 5_000,
  ) {
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1)
      throw new PipelineConfigurationError(
        'maxAttempts must be a positive integer',
      );
  }

  delayMs(attempt: number): number {
    return Math.min(
      this.initialDelayMs * 2 ** (attempt - 1),
      this.maximumDelayMs,
    );
  }

  shouldRetry(): boolean {
    return true;
  }
}

export class TimerSleeper implements Sleeper {
  sleep(milliseconds: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) return reject(signal.reason);
      const onAbort = () => {
        clearTimeout(timer);
        reject(signal?.reason);
      };
      const timer = setTimeout(() => {
        signal?.removeEventListener('abort', onAbort);
        resolve();
      }, milliseconds);
      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }
}

export async function executeWithRetry<T>(options: {
  readonly runId: string;
  readonly stage: PipelineStage;
  readonly operation: () => Promise<T>;
  readonly retryPolicy: RetryPolicy;
  readonly sleeper: Sleeper;
  readonly logger: PipelineLogger;
  readonly signal?: AbortSignal;
}): Promise<T> {
  const { runId, stage, operation, retryPolicy, sleeper, logger, signal } =
    options;
  for (let attempt = 1; attempt <= retryPolicy.maxAttempts; attempt += 1) {
    if (signal?.aborted) throw new PipelineAbortedError(runId, stage);
    try {
      logger.debug(
        'Pipeline stage started',
        stageLogContext(runId, stage, attempt),
      );
      const result = await operation();
      logger.debug(
        'Pipeline stage completed',
        stageLogContext(runId, stage, attempt),
      );
      return result;
    } catch (error) {
      if (signal?.aborted) throw new PipelineAbortedError(runId, stage);
      const retry =
        attempt < retryPolicy.maxAttempts &&
        retryPolicy.shouldRetry(error, attempt);
      if (!retry) {
        logger.error('Pipeline stage failed', {
          ...stageLogContext(runId, stage, attempt),
          error: error instanceof Error ? error.message : String(error),
        });
        throw new PipelineStageError(runId, stage, attempt, error);
      }
      const delayMs = retryPolicy.delayMs(attempt, error);
      logger.warn('Pipeline stage failed; retry scheduled', {
        ...stageLogContext(runId, stage, attempt),
        delayMs,
        error: error instanceof Error ? error.message : String(error),
      });
      try {
        await sleeper.sleep(delayMs, signal);
      } catch (sleepError) {
        if (signal?.aborted) throw new PipelineAbortedError(runId, stage);
        throw new PipelineStageError(runId, stage, attempt, sleepError);
      }
    }
  }
  throw new PipelineStageError(
    runId,
    stage,
    retryPolicy.maxAttempts,
    undefined,
  );
}
