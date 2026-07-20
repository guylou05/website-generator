import type { BusinessAnalysis } from '../analyzer/index.js';
import type { WebsitePlan } from '../planner/index.js';

export interface WebsiteContent {
  readonly pages: Readonly<Record<string, PageContent>>;
}

export interface PageContent {
  readonly sections: Readonly<Record<string, SectionContent>>;
}

export interface SectionContent {
  readonly heading?: string;
  readonly body?: string;
  readonly items?: readonly ContentItem[];
  readonly callToAction?: CallToActionContent;
}

export interface ContentItem {
  readonly title: string;
  readonly body: string;
}

export interface CallToActionContent {
  readonly label: string;
  readonly destination: string;
}

export interface SeoContent {
  readonly siteTitle: string;
  readonly pages: Readonly<Record<string, PageSeoContent>>;
}

export interface PageSeoContent {
  readonly title: string;
  readonly description: string;
  readonly keywords: readonly string[];
}

export interface ContentWriter {
  write(
    input: Readonly<ContentWritingInput>,
    context: WritingContext,
  ): Promise<WebsiteContent>;
}

export interface SeoGenerator {
  generate(
    input: Readonly<SeoGenerationInput>,
    context: WritingContext,
  ): Promise<SeoContent>;
}

export interface ContentWritingInput {
  readonly analysis: BusinessAnalysis;
  readonly plan: WebsitePlan;
}

export interface SeoGenerationInput extends ContentWritingInput {
  readonly content: WebsiteContent;
}

export interface WritingContext {
  readonly runId: string;
  readonly signal?: AbortSignal;
}

export class UnconfiguredContentWriter implements ContentWriter {
  async write(): Promise<WebsiteContent> {
    throw new Error('No ContentWriter implementation has been configured');
  }
}

export class UnconfiguredSeoGenerator implements SeoGenerator {
  async generate(): Promise<SeoContent> {
    throw new Error('No SeoGenerator implementation has been configured');
  }
}
