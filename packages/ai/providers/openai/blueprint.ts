import type { BlueprintGenerator } from '../../orchestrator/contracts.js';
import type { StructuredOpenAIClient } from './client.js';
import { prompts } from './prompts.js';
import { siteBlueprintSchema } from './schemas.js';
export class OpenAIBlueprintGenerator implements BlueprintGenerator {
  constructor(private readonly client: StructuredOpenAIClient) {}
  async generate(
    input: Parameters<BlueprintGenerator['generate']>[0],
    context: Parameters<BlueprintGenerator['generate']>[1],
  ) {
    return (await this.client.generate(
      'website_blueprint',
      prompts.blueprint,
      input,
      siteBlueprintSchema,
      context.signal,
    )) as Awaited<ReturnType<BlueprintGenerator['generate']>>;
  }
}
