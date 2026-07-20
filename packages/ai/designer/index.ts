import type { BusinessProfile } from '../analyzer/index.js';
import type { WebsitePlan } from '../planner/index.js';
import type { WebsiteContent } from '../writer/index.js';

/** Semantic design direction; renderer-specific CSS or builder settings are excluded. */
export interface DesignPlan {
  readonly direction: string;
  readonly colors: DesignColors;
  readonly typography: DesignTypography;
  readonly globalStyles: GlobalDesignStyles;
  readonly pageLayouts: Readonly<Record<string, PageLayoutPlan>>;
}

export interface DesignColors {
  readonly primary: string;
  readonly secondary: string;
  readonly accent: string;
  readonly background: string;
  readonly surface: string;
  readonly text: string;
  readonly mutedText: string;
}

export interface DesignTypography {
  readonly headingFont: string;
  readonly bodyFont: string;
}

export interface GlobalDesignStyles {
  readonly borderRadius: 'none' | 'small' | 'medium' | 'large' | 'pill';
  readonly contentWidth: 'narrow' | 'standard' | 'wide';
  readonly spacingScale: 'compact' | 'comfortable' | 'spacious';
}

export interface PageLayoutPlan {
  readonly sections: Readonly<Record<string, SectionLayoutPlan>>;
}

export interface SectionLayoutPlan {
  readonly container: 'narrow' | 'standard' | 'wide' | 'full';
  readonly columns: number;
  readonly background:
    'default' | 'surface' | 'primary' | 'secondary' | 'accent';
}

export interface DesignPlanningInput {
  readonly profile: BusinessProfile;
  readonly plan: WebsitePlan;
  readonly content: WebsiteContent;
}

export interface DesignPlanner {
  plan(
    input: Readonly<DesignPlanningInput>,
    context: DesignContext,
  ): Promise<DesignPlan>;
}

export interface DesignContext {
  readonly runId: string;
  readonly signal?: AbortSignal;
}

export class UnconfiguredDesignPlanner implements DesignPlanner {
  async plan(): Promise<DesignPlan> {
    throw new Error('No DesignPlanner implementation has been configured');
  }
}
