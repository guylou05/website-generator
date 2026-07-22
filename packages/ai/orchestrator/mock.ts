import type { BusinessAnalysis } from '../analyzer/index.js';
import type { DesignPlan } from '../designer/index.js';
import type { WebsitePlan } from '../planner/index.js';
import type { SeoContent, WebsiteContent } from '../writer/index.js';
import type { SiteBlueprint } from '@website-generator/shared/schema';

export interface MockAiResponses {
  readonly analysis: BusinessAnalysis;
  readonly plan: WebsitePlan;
  readonly content: WebsiteContent;
  readonly seo: SeoContent;
  readonly design: DesignPlan;
  readonly blueprint: SiteBlueprint;
}

export type MockStage = keyof MockAiResponses;

/** Deterministic adapters for unit tests and local development; they perform no I/O. */
export class MockAiProvider {
  readonly calls: MockStage[] = [];
  private readonly failures = new Map<MockStage, number>();

  constructor(private readonly responses: MockAiResponses) {}

  readonly analyzer = { analyze: async () => this.respond('analysis') };
  readonly planner = { plan: async () => this.respond('plan') };
  readonly writer = { write: async () => this.respond('content') };
  readonly seoGenerator = { generate: async () => this.respond('seo') };
  readonly designer = { plan: async () => this.respond('design') };
  readonly blueprintGenerator = {
    generate: async () => this.respond('blueprint'),
  };

  failNext(stage: MockStage, count = 1): this {
    this.failures.set(stage, count);
    return this;
  }

  private respond<K extends MockStage>(stage: K): MockAiResponses[K] {
    this.calls.push(stage);
    const remaining = this.failures.get(stage) ?? 0;
    if (remaining > 0) {
      this.failures.set(stage, remaining - 1);
      throw new Error(`Mock ${stage} failure`);
    }
    return this.responses[stage];
  }
}
