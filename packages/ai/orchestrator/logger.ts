import type { PipelineStage } from './contracts.js';

export type LogContext = Readonly<Record<string, unknown>>;

/** Applications inject their logger; the package never assumes a logging vendor. */
export interface PipelineLogger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
}

export class NoopPipelineLogger implements PipelineLogger {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}

export function stageLogContext(
  runId: string,
  stage: PipelineStage,
  attempt?: number,
): LogContext {
  return { runId, stage, ...(attempt === undefined ? {} : { attempt }) };
}
