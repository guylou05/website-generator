import type { SiteBlueprint } from '@website-generator/shared/schema';
import type { BusinessProfile } from '../analyzer/index.js';
import type { DesignPlan } from '../designer/index.js';
import type { WebsitePlan } from '../planner/index.js';
import type { SeoContent, WebsiteContent } from '../writer/index.js';
import type { BlueprintGenerator } from './contracts.js';
import { PipelineStageError, StageTimeoutError } from './errors.js';
import type { PipelineLogger } from './logger.js';
import { NoopPipelineLogger, stageLogContext } from './logger.js';
import type { GenerationMetrics } from './metrics.js';
import { NoopGenerationMetrics } from './metrics.js';
import type { RetryPolicy, Sleeper } from './retry.js';
import { ExponentialBackoffRetryPolicy, TimerSleeper } from './retry.js';
import type { BusinessAnalyzer } from '../analyzer/index.js';
import type { DesignPlanner } from '../designer/index.js';
import type { WebsitePlanner } from '../planner/index.js';
import type { ContentWriter, SeoGenerator } from '../writer/index.js';

export const GENERATION_STAGES = [
  'analysis',
  'planning',
  'writing',
  'seo',
  'design',
  'blueprint',
] as const;

export type GenerationStage = (typeof GENERATION_STAGES)[number];
export type GenerationStatus =
  'pending' | 'running' | 'retrying' | 'completed' | 'failed';

export interface GenerationProgress {
  readonly projectId: string;
  readonly runId: string;
  readonly stage: GenerationStage;
  readonly status: GenerationStatus;
  readonly attempt: number;
  readonly completedStages: number;
  readonly totalStages: number;
  readonly percentage: number;
  readonly timestamp: Date;
}

export type GenerationEvent =
  | {
      readonly type: 'generation.started';
      readonly progress: GenerationProgress;
    }
  | { readonly type: 'stage.started'; readonly progress: GenerationProgress }
  | {
      readonly type: 'stage.retrying';
      readonly progress: GenerationProgress;
      readonly error: unknown;
      readonly delayMs: number;
    }
  | {
      readonly type: 'stage.completed';
      readonly progress: GenerationProgress;
      readonly durationMs: number;
    }
  | {
      readonly type: 'stage.failed';
      readonly progress: GenerationProgress;
      readonly error: unknown;
      readonly durationMs: number;
    }
  | {
      readonly type: 'generation.completed';
      readonly progress: GenerationProgress;
      readonly durationMs: number;
    };

export interface GenerationResult {
  readonly projectId: string;
  readonly runId: string;
  readonly blueprint: SiteBlueprint;
  readonly startedAt: Date;
  readonly completedAt: Date;
  readonly durationMs: number;
}

export interface ProjectSource {
  getProfile(projectId: string): Promise<BusinessProfile>;
}
export interface GenerationEventReporter {
  report(event: GenerationEvent): void | Promise<void>;
}

export interface StageConfiguration {
  readonly timeoutMs?: number;
  readonly retryPolicy?: RetryPolicy;
}

export interface WebsiteGeneratorDependencies {
  readonly projects: ProjectSource;
  readonly analyzer: BusinessAnalyzer;
  readonly planner: WebsitePlanner;
  readonly writer: ContentWriter;
  readonly seoGenerator: SeoGenerator;
  readonly designer: DesignPlanner;
  readonly blueprintGenerator: BlueprintGenerator;
  readonly reporter?: GenerationEventReporter;
  readonly logger?: PipelineLogger;
  readonly metrics?: GenerationMetrics;
  readonly sleeper?: Sleeper;
  readonly stages?: Partial<Record<GenerationStage, StageConfiguration>>;
  readonly defaultTimeoutMs?: number;
  readonly retryPolicy?: RetryPolicy;
  readonly now?: () => Date;
  readonly createRunId?: () => string;
}

type State = {
  profile: BusinessProfile;
  analysis?: Awaited<ReturnType<BusinessAnalyzer['analyze']>>;
  plan?: WebsitePlan;
  content?: WebsiteContent;
  seo?: SeoContent;
  design?: DesignPlan;
  blueprint?: SiteBlueprint;
};

/** Provider-neutral, observable orchestration of the complete website pipeline. */
export class WebsiteGenerationOrchestrator {
  private readonly logger: PipelineLogger;
  private readonly metrics: GenerationMetrics;
  private readonly sleeper: Sleeper;
  private readonly defaultRetry: RetryPolicy;
  private readonly now: () => Date;

  constructor(private readonly dependencies: WebsiteGeneratorDependencies) {
    this.logger = dependencies.logger ?? new NoopPipelineLogger();
    this.metrics = dependencies.metrics ?? new NoopGenerationMetrics();
    this.sleeper = dependencies.sleeper ?? new TimerSleeper();
    this.defaultRetry =
      dependencies.retryPolicy ?? new ExponentialBackoffRetryPolicy();
    this.now = dependencies.now ?? (() => new Date());
  }

  async generateWebsite(projectId: string): Promise<GenerationResult> {
    if (!projectId.trim()) throw new TypeError('projectId must not be empty');
    const startedAt = this.now();
    const runId =
      this.dependencies.createRunId?.() ??
      `generation-${projectId}-${startedAt.getTime()}`;
    const state: State = {
      profile: await this.dependencies.projects.getProfile(projectId),
    };
    this.logger.info('Website generation started', { projectId, runId });
    await this.emit(
      'generation.started',
      this.progress(projectId, runId, 'analysis', 'pending', 0, 0),
    );

    await this.runStage(
      projectId,
      runId,
      'analysis',
      0,
      state,
      (signal) =>
        this.dependencies.analyzer.analyze(state.profile, { runId, signal }),
      (value) => {
        state.analysis = value;
      },
    );
    await this.runStage(
      projectId,
      runId,
      'planning',
      1,
      state,
      (signal) =>
        this.dependencies.planner.plan(state.analysis!, { runId, signal }),
      (value) => {
        state.plan = value;
      },
    );
    await this.runStage(
      projectId,
      runId,
      'writing',
      2,
      state,
      (signal) =>
        this.dependencies.writer.write(
          { analysis: state.analysis!, plan: state.plan! },
          { runId, signal },
        ),
      (value) => {
        state.content = value;
      },
    );
    await this.runStage(
      projectId,
      runId,
      'seo',
      3,
      state,
      (signal) =>
        this.dependencies.seoGenerator.generate(
          {
            analysis: state.analysis!,
            plan: state.plan!,
            content: state.content!,
          },
          { runId, signal },
        ),
      (value) => {
        state.seo = value;
      },
    );
    await this.runStage(
      projectId,
      runId,
      'design',
      4,
      state,
      (signal) =>
        this.dependencies.designer.plan(
          {
            profile: state.profile,
            plan: state.plan!,
            content: state.content!,
          },
          { runId, signal },
        ),
      (value) => {
        state.design = value;
      },
    );
    await this.runStage(
      projectId,
      runId,
      'blueprint',
      5,
      state,
      (signal) =>
        this.dependencies.blueprintGenerator.generate(
          {
            profile: state.profile,
            analysis: state.analysis!,
            plan: state.plan!,
            content: state.content!,
            seo: state.seo!,
            design: state.design!,
          },
          { runId, signal },
        ),
      (value) => {
        state.blueprint = value;
      },
    );

    const completedAt = this.now();
    const durationMs = completedAt.getTime() - startedAt.getTime();
    await this.emit(
      'generation.completed',
      this.progress(
        projectId,
        runId,
        'blueprint',
        'completed',
        1,
        GENERATION_STAGES.length,
      ),
      { durationMs },
    );
    this.metrics.generationCompleted(durationMs);
    this.logger.info('Website generation completed', {
      projectId,
      runId,
      durationMs,
    });
    return {
      projectId,
      runId,
      blueprint: state.blueprint!,
      startedAt,
      completedAt,
      durationMs,
    };
  }

  private async runStage<T>(
    projectId: string,
    runId: string,
    stage: GenerationStage,
    completed: number,
    _state: State,
    operation: (signal: AbortSignal) => Promise<T>,
    assign: (value: T) => void,
  ): Promise<void> {
    const config = this.dependencies.stages?.[stage];
    const retry = config?.retryPolicy ?? this.defaultRetry;
    const timeoutMs =
      config?.timeoutMs ?? this.dependencies.defaultTimeoutMs ?? 30_000;
    const began = this.now().getTime();
    for (let attempt = 1; attempt <= retry.maxAttempts; attempt += 1) {
      const progress = this.progress(
        projectId,
        runId,
        stage,
        'running',
        attempt,
        completed,
      );
      await this.emit('stage.started', progress);
      this.logger.info('Generation stage started', {
        projectId,
        ...stageLogContext(runId, stage, attempt),
        timeoutMs,
      });
      try {
        const value = await this.withTimeout(
          operation,
          timeoutMs,
          runId,
          stage,
        );
        assign(value);
        const durationMs = this.now().getTime() - began;
        await this.emit(
          'stage.completed',
          this.progress(
            projectId,
            runId,
            stage,
            'completed',
            attempt,
            completed + 1,
          ),
          { durationMs },
        );
        this.metrics.stageCompleted(stage, durationMs, attempt);
        this.logger.info('Generation stage completed', {
          projectId,
          ...stageLogContext(runId, stage, attempt),
          durationMs,
        });
        return;
      } catch (error) {
        const canRetry =
          attempt < retry.maxAttempts && retry.shouldRetry(error, attempt);
        if (!canRetry) {
          const durationMs = this.now().getTime() - began;
          await this.emit(
            'stage.failed',
            this.progress(
              projectId,
              runId,
              stage,
              'failed',
              attempt,
              completed,
            ),
            { error, durationMs },
          );
          this.metrics.stageFailed(stage, durationMs, attempt);
          this.logger.error('Generation stage failed', {
            projectId,
            ...stageLogContext(runId, stage, attempt),
            durationMs,
            error: error instanceof Error ? error.message : String(error),
          });
          throw new PipelineStageError(runId, stage, attempt, error);
        }
        const delayMs = retry.delayMs(attempt, error);
        await this.emit(
          'stage.retrying',
          this.progress(
            projectId,
            runId,
            stage,
            'retrying',
            attempt,
            completed,
          ),
          { error, delayMs },
        );
        this.metrics.stageRetried(stage, attempt);
        this.logger.warn('Generation stage retry scheduled', {
          projectId,
          ...stageLogContext(runId, stage, attempt),
          delayMs,
        });
        await this.sleeper.sleep(delayMs);
      }
    }
  }

  private async withTimeout<T>(
    operation: (signal: AbortSignal) => Promise<T>,
    timeoutMs: number,
    runId: string,
    stage: GenerationStage,
  ): Promise<T> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new StageTimeoutError(runId, stage, timeoutMs));
      }, timeoutMs);
    });
    try {
      return await Promise.race([operation(controller.signal), timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private progress(
    projectId: string,
    runId: string,
    stage: GenerationStage,
    status: GenerationStatus,
    attempt: number,
    completedStages: number,
  ): GenerationProgress {
    return {
      projectId,
      runId,
      stage,
      status,
      attempt,
      completedStages,
      totalStages: GENERATION_STAGES.length,
      percentage: Math.round(
        (completedStages / GENERATION_STAGES.length) * 100,
      ),
      timestamp: this.now(),
    };
  }

  private async emit(
    type: GenerationEvent['type'],
    progress: GenerationProgress,
    extra: Record<string, unknown> = {},
  ): Promise<void> {
    await this.dependencies.reporter?.report({
      type,
      progress,
      ...extra,
    } as GenerationEvent);
  }
}

let defaultOrchestrator: WebsiteGenerationOrchestrator | undefined;

export function configureWebsiteGenerator(
  dependencies: WebsiteGeneratorDependencies,
): void {
  defaultOrchestrator = new WebsiteGenerationOrchestrator(dependencies);
}

/** Application-level entry point. Configure dependencies once at the composition root. */
export function generateWebsite(projectId: string): Promise<GenerationResult> {
  if (!defaultOrchestrator)
    throw new Error('Website generator has not been configured');
  return defaultOrchestrator.generateWebsite(projectId);
}
