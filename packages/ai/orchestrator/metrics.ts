import type { GenerationStage } from './generation.js';

/** Minimal vendor-neutral metrics port; adapters can target Prometheus or OpenTelemetry. */
export interface GenerationMetrics {
  stageCompleted(
    stage: GenerationStage,
    durationMs: number,
    attempts: number,
  ): void;
  stageFailed(
    stage: GenerationStage,
    durationMs: number,
    attempts: number,
  ): void;
  stageRetried(stage: GenerationStage, attempt: number): void;
  generationCompleted(durationMs: number): void;
}

export class NoopGenerationMetrics implements GenerationMetrics {
  stageCompleted(): void {}
  stageFailed(): void {}
  stageRetried(): void {}
  generationCompleted(): void {}
}
