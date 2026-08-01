import type { BlueprintGenerator } from '../../orchestrator/contracts.js';
import type { StructuredOpenAIClient } from './client.js';
import { prompts } from './prompts.js';
import {
  openAIWebsiteBlueprintSchema,
  siteBlueprintSchema,
} from './schemas.js';
export class OpenAIBlueprintGenerator implements BlueprintGenerator {
  constructor(private readonly client: StructuredOpenAIClient) {}
  async generate(
    input: Parameters<BlueprintGenerator['generate']>[0],
    context: Parameters<BlueprintGenerator['generate']>[1],
  ) {
    const generated = await this.client.generate(
      'website_blueprint',
      prompts.blueprint,
      input,
      openAIWebsiteBlueprintSchema,
      context.signal,
    );
    return siteBlueprintSchema.parse(generated);
  }
  async repair(
    input: Parameters<NonNullable<BlueprintGenerator['repair']>>[0],
    invalidBlueprint: unknown,
    issues: Parameters<NonNullable<BlueprintGenerator['repair']>>[2],
    context: Parameters<NonNullable<BlueprintGenerator['repair']>>[3],
  ) {
    const generated = await this.client.generate(
      'website_blueprint_repair',
      `${prompts.blueprint}\nCorrect the supplied blueprint. Change only fields required by these validation issues: ${JSON.stringify(issues)}.`,
      { source: input, invalidBlueprint },
      openAIWebsiteBlueprintSchema,
      context.signal,
    );
    return siteBlueprintSchema.parse(generated);
  }
}
