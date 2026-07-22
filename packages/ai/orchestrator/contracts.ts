import type { SiteBlueprint } from '@website-generator/shared/schema';
import type { BusinessAnalysis, BusinessProfile } from '../analyzer/index.js';
import type { DesignPlan } from '../designer/index.js';
import type { WebsitePlan } from '../planner/index.js';
import type { SeoContent, WebsiteContent } from '../writer/index.js';

export type PipelineStage =
  'analysis' | 'planning' | 'writing' | 'seo' | 'design' | 'blueprint';

export interface BlueprintGenerationInput {
  readonly profile: BusinessProfile;
  readonly analysis: BusinessAnalysis;
  readonly plan: WebsitePlan;
  readonly content: WebsiteContent;
  readonly seo: SeoContent;
  readonly design: DesignPlan;
}

export interface BlueprintGenerator {
  generate(
    input: Readonly<BlueprintGenerationInput>,
    context: GenerationContext,
  ): Promise<SiteBlueprint>;
}

export interface GenerationContext {
  readonly runId: string;
  readonly signal?: AbortSignal;
}

export interface GenerationRequest {
  readonly profile: BusinessProfile;
  readonly runId?: string;
  readonly signal?: AbortSignal;
}

/** @deprecated Use the website orchestrator's GenerationResult for new integrations. */
export interface PipelineGenerationResult {
  readonly runId: string;
  readonly blueprint: SiteBlueprint;
  readonly completedAt: Date;
}

export interface GenerationPipeline {
  generate(
    request: Readonly<GenerationRequest>,
  ): Promise<PipelineGenerationResult>;
}

export class UnconfiguredBlueprintGenerator implements BlueprintGenerator {
  async generate(): Promise<SiteBlueprint> {
    throw new Error('No BlueprintGenerator implementation has been configured');
  }
}
