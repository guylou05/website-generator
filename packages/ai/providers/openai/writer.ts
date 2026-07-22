import type { ContentWriter, SeoGenerator } from '../../writer/index.js';
import type { StructuredOpenAIClient } from './client.js';
import { prompts } from './prompts.js';
import { seoContentSchema, websiteContentSchema } from './schemas.js';
export class OpenAIContentWriter implements ContentWriter {
  constructor(private readonly client: StructuredOpenAIClient) {}
  async write(
    input: Parameters<ContentWriter['write']>[0],
    context: Parameters<ContentWriter['write']>[1],
  ) {
    return (await this.client.generate(
      'website_copy',
      prompts.writing,
      input,
      websiteContentSchema,
      context.signal,
    )) as Awaited<ReturnType<ContentWriter['write']>>;
  }
}
export class OpenAISeoGenerator implements SeoGenerator {
  constructor(private readonly client: StructuredOpenAIClient) {}
  generate(
    input: Parameters<SeoGenerator['generate']>[0],
    context: Parameters<SeoGenerator['generate']>[1],
  ) {
    return this.client.generate(
      'seo_strategy',
      prompts.seo,
      input,
      seoContentSchema,
      context.signal,
    );
  }
}
