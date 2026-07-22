import type { PipelineStage } from './contracts.js';

export class PipelineError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'PipelineError';
  }
}

export class PipelineConfigurationError extends PipelineError {
  constructor(message: string) {
    super(message);
    this.name = 'PipelineConfigurationError';
  }
}

export class PipelineAbortedError extends PipelineError {
  constructor(
    readonly runId: string,
    readonly stage: PipelineStage,
  ) {
    super(`Generation pipeline ${runId} was aborted during ${stage}`);
    this.name = 'PipelineAbortedError';
  }
}

export class PipelineStageError extends PipelineError {
  constructor(
    readonly runId: string,
    readonly stage: PipelineStage,
    readonly attempts: number,
    cause: unknown,
  ) {
    super(
      `Generation pipeline ${runId} failed during ${stage} after ${attempts} attempt(s)`,
      {
        cause,
      },
    );
    this.name = 'PipelineStageError';
  }
}

export class StageTimeoutError extends PipelineError {
  constructor(
    readonly runId: string,
    readonly stage: PipelineStage,
    readonly timeoutMs: number,
  ) {
    super(
      `Generation pipeline ${runId} timed out during ${stage} after ${timeoutMs}ms`,
    );
    this.name = 'StageTimeoutError';
  }
}
