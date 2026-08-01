import type { ContentWriter, SeoGenerator } from '../../writer/index.js';
import type { StructuredOpenAIClient } from './client.js';
import { prompts } from './prompts.js';
import {
  seoContentFromTransport,
  seoContentTransportSchema,
  websiteContentFromTransport,
  websiteContentToTransport,
  websiteContentTransportSchema,
} from './schemas.js';
export class OpenAIContentWriter implements ContentWriter {
  constructor(private readonly client: StructuredOpenAIClient) {}
  async write(
    input: Parameters<ContentWriter['write']>[0],
    context: Parameters<ContentWriter['write']>[1],
  ) {
    const transport = await this.client.generate(
      'website_copy',
      prompts.writing,
      input,
      websiteContentTransportSchema,
      context.signal,
    );
    return websiteContentFromTransport(transport);
  }
}
export class OpenAISeoGenerator implements SeoGenerator {
  constructor(private readonly client: StructuredOpenAIClient) {}
  async generate(
    input: Parameters<SeoGenerator['generate']>[0],
    context: Parameters<SeoGenerator['generate']>[1],
  ) {
    const transport = await this.client.generate(
      'seo_strategy',
      prompts.seo,
      { ...input, content: websiteContentToTransport(input.content) },
      seoContentTransportSchema,
      context.signal,
    );
    return seoContentFromTransport(transport);
  }
}
