import type { DesignPlanner } from '../../designer/index.js';
import type { StructuredOpenAIClient } from './client.js';
import { prompts } from './prompts.js';
import {
  designPlanFromTransport,
  designPlanTransportSchema,
  websiteContentToTransport,
} from './schemas.js';
export class OpenAIDesignPlanner implements DesignPlanner {
  constructor(private readonly client: StructuredOpenAIClient) {}
  async plan(
    input: Parameters<DesignPlanner['plan']>[0],
    context: Parameters<DesignPlanner['plan']>[1],
  ) {
    const transport = await this.client.generate(
      'design_plan',
      prompts.design,
      { ...input, content: websiteContentToTransport(input.content) },
      designPlanTransportSchema,
      context.signal,
    );
    return designPlanFromTransport(transport);
  }
}
