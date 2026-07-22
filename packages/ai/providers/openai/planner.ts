import type { WebsitePlanner } from '../../planner/index.js';
import type { StructuredOpenAIClient } from './client.js';
import { prompts } from './prompts.js';
import { websitePlanSchema } from './schemas.js';
export class OpenAIWebsitePlanner implements WebsitePlanner {
  constructor(private readonly client: StructuredOpenAIClient) {}
  async plan(
    analysis: Parameters<WebsitePlanner['plan']>[0],
    context: Parameters<WebsitePlanner['plan']>[1],
  ) {
    return (await this.client.generate(
      'website_plan',
      prompts.planning,
      analysis,
      websitePlanSchema,
      context.signal,
    )) as Awaited<ReturnType<WebsitePlanner['plan']>>;
  }
}
