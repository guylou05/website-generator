import type { BusinessAnalyzer } from '../analyzer/index.js';
import type { DesignPlanner } from '../designer/index.js';
import type { WebsitePlanner } from '../planner/index.js';
import type { ContentWriter, SeoGenerator } from '../writer/index.js';
import type {
  BlueprintGenerator,
  GenerationContext,
  GenerationPipeline,
  GenerationRequest,
  GenerationResult,
  PipelineStage,
} from './contracts.js';
import type { PipelineLogger } from './logger.js';
import { NoopPipelineLogger } from './logger.js';
import type { RetryPolicy, Sleeper } from './retry.js';
import {
  executeWithRetry,
  ExponentialBackoffRetryPolicy,
  TimerSleeper,
} from './retry.js';

export interface Clock {
  now(): Date;
}

export interface RunIdFactory {
  create(): string;
}

export interface GenerationPipelineDependencies {
  readonly analyzer: BusinessAnalyzer;
  readonly planner: WebsitePlanner;
  readonly writer: ContentWriter;
  readonly seoGenerator: SeoGenerator;
  readonly designer: DesignPlanner;
  readonly blueprintGenerator: BlueprintGenerator;
  readonly logger?: PipelineLogger;
  readonly retryPolicy?: RetryPolicy;
  readonly sleeper?: Sleeper;
  readonly clock?: Clock;
  readonly runIdFactory?: RunIdFactory;
}

class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

class TimestampRunIdFactory implements RunIdFactory {
  private sequence = 0;

  create(): string {
    this.sequence += 1;
    return `generation-${Date.now()}-${this.sequence}`;
  }
}

/** Coordinates injected capabilities and owns no AI-provider behavior. */
export class AsyncGenerationPipeline implements GenerationPipeline {
  private readonly logger: PipelineLogger;
  private readonly retryPolicy: RetryPolicy;
  private readonly sleeper: Sleeper;
  private readonly clock: Clock;
  private readonly runIdFactory: RunIdFactory;

  constructor(private readonly dependencies: GenerationPipelineDependencies) {
    this.logger = dependencies.logger ?? new NoopPipelineLogger();
    this.retryPolicy =
      dependencies.retryPolicy ?? new ExponentialBackoffRetryPolicy();
    this.sleeper = dependencies.sleeper ?? new TimerSleeper();
    this.clock = dependencies.clock ?? new SystemClock();
    this.runIdFactory =
      dependencies.runIdFactory ?? new TimestampRunIdFactory();
  }

  async generate(
    request: Readonly<GenerationRequest>,
  ): Promise<GenerationResult> {
    const runId = request.runId ?? this.runIdFactory.create();
    const context: GenerationContext = {
      runId,
      ...(request.signal ? { signal: request.signal } : {}),
    };
    this.logger.info('Generation pipeline started', { runId });

    const analysis = await this.stage('analysis', context, () =>
      this.dependencies.analyzer.analyze(request.profile, context),
    );
    const plan = await this.stage('planning', context, () =>
      this.dependencies.planner.plan(analysis, context),
    );
    const content = await this.stage('writing', context, () =>
      this.dependencies.writer.write({ analysis, plan }, context),
    );
    const seo = await this.stage('seo', context, () =>
      this.dependencies.seoGenerator.generate(
        { analysis, plan, content },
        context,
      ),
    );
    const design = await this.stage('design', context, () =>
      this.dependencies.designer.plan(
        { profile: request.profile, plan, content },
        context,
      ),
    );
    const blueprint = await this.stage('blueprint', context, () =>
      this.dependencies.blueprintGenerator.generate(
        { profile: request.profile, analysis, plan, content, seo, design },
        context,
      ),
    );

    const result = { runId, blueprint, completedAt: this.clock.now() };
    this.logger.info('Generation pipeline completed', { runId });
    return result;
  }

  private stage<T>(
    stage: PipelineStage,
    context: GenerationContext,
    operation: () => Promise<T>,
  ): Promise<T> {
    return executeWithRetry({
      runId: context.runId,
      stage,
      operation,
      retryPolicy: this.retryPolicy,
      sleeper: this.sleeper,
      logger: this.logger,
      ...(context.signal ? { signal: context.signal } : {}),
    });
  }
}
