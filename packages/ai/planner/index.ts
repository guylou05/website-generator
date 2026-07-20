import type { BusinessAnalysis } from '../analyzer/index.js';

export interface WebsitePlan {
  readonly strategy: string;
  readonly primaryGoal: string;
  readonly navigation: readonly PlannedNavigationItem[];
  readonly pages: readonly PlannedPage[];
}

export interface PlannedNavigationItem {
  readonly label: string;
  readonly pageKey: string;
  readonly children?: readonly PlannedNavigationItem[];
}

export interface PlannedPage {
  readonly key: string;
  readonly title: string;
  readonly purpose: string;
  readonly audience: string;
  readonly sections: readonly PlannedSection[];
}

export interface PlannedSection {
  readonly key: string;
  readonly purpose: string;
  readonly type:
    | 'hero'
    | 'content'
    | 'features'
    | 'services'
    | 'testimonials'
    | 'cta'
    | 'contact'
    | 'custom';
  readonly contentRequirements: readonly string[];
}

export interface WebsitePlanner {
  plan(
    analysis: Readonly<BusinessAnalysis>,
    context: PlanningContext,
  ): Promise<WebsitePlan>;
}

export interface PlanningContext {
  readonly runId: string;
  readonly signal?: AbortSignal;
}

export class UnconfiguredWebsitePlanner implements WebsitePlanner {
  async plan(): Promise<WebsitePlan> {
    throw new Error('No WebsitePlanner implementation has been configured');
  }
}
