/** Raw, provider-neutral facts supplied by a business. */
export interface BusinessProfile {
  readonly businessName: string;
  readonly description: string;
  readonly industry: string;
  readonly location?: string;
  readonly targetAudiences: readonly string[];
  readonly productsOrServices: readonly BusinessOffering[];
  readonly differentiators: readonly string[];
  readonly goals: readonly string[];
  readonly existingWebsiteUrl?: string;
  readonly brandPreferences?: Readonly<Record<string, string>>;
}

export interface BusinessOffering {
  readonly name: string;
  readonly description: string;
  readonly audience?: string;
}

/** Structured understanding passed to planning, without provider-specific data. */
export interface BusinessAnalysis {
  readonly summary: string;
  readonly industry: string;
  readonly audiences: readonly AudienceInsight[];
  readonly offerings: readonly BusinessOffering[];
  readonly valueProposition: string;
  readonly goals: readonly string[];
  readonly recommendedTone: readonly string[];
  readonly constraints: readonly string[];
}

export interface AudienceInsight {
  readonly name: string;
  readonly needs: readonly string[];
  readonly objections: readonly string[];
}

export interface BusinessAnalyzer {
  analyze(
    profile: Readonly<BusinessProfile>,
    context: AnalysisContext,
  ): Promise<BusinessAnalysis>;
}

export interface AnalysisContext {
  readonly runId: string;
  readonly signal?: AbortSignal;
}

/** Safe default that makes missing provider configuration explicit. */
export class UnconfiguredBusinessAnalyzer implements BusinessAnalyzer {
  async analyze(): Promise<BusinessAnalysis> {
    throw new Error('No BusinessAnalyzer implementation has been configured');
  }
}
