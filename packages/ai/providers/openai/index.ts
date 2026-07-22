import { OpenAIBusinessAnalyzer } from './analyzer.js';
import { OpenAIBlueprintGenerator } from './blueprint.js';
import { OpenAIStructuredClient } from './client.js';
import { readOpenAIConfig, type OpenAIProviderConfig } from './config.js';
import { OpenAIDesignPlanner } from './designer.js';
import { OpenAIWebsitePlanner } from './planner.js';
import { OpenAIContentWriter, OpenAISeoGenerator } from './writer.js';
export * from './analyzer.js';
export * from './blueprint.js';
export * from './client.js';
export * from './config.js';
export * from './designer.js';
export * from './planner.js';
export * from './prompts.js';
export * from './schemas.js';
export * from './writer.js';
export function createOpenAIProvider(
  config: OpenAIProviderConfig = readOpenAIConfig(),
) {
  const client = new OpenAIStructuredClient(config);
  return {
    client,
    analyzer: new OpenAIBusinessAnalyzer(client),
    planner: new OpenAIWebsitePlanner(client),
    writer: new OpenAIContentWriter(client),
    seoGenerator: new OpenAISeoGenerator(client),
    designer: new OpenAIDesignPlanner(client),
    blueprintGenerator: new OpenAIBlueprintGenerator(client),
  };
}
