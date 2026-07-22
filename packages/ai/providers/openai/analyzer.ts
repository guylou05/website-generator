import type { BusinessAnalyzer } from '../../analyzer/index.js';
import type { StructuredOpenAIClient } from './client.js';
import { prompts } from './prompts.js';
import { businessAnalysisSchema } from './schemas.js';
export class OpenAIBusinessAnalyzer implements BusinessAnalyzer {
  constructor(private readonly client: StructuredOpenAIClient) {}
  async analyze(
    profile: Parameters<BusinessAnalyzer['analyze']>[0],
    context: Parameters<BusinessAnalyzer['analyze']>[1],
  ) {
    return (await this.client.generate(
      'business_analysis',
      prompts.analysis,
      profile,
      businessAnalysisSchema,
      context.signal,
    )) as Awaited<ReturnType<BusinessAnalyzer['analyze']>>;
  }
}
