import type { DesignPlanner } from '../../designer/index.js';
import type { StructuredOpenAIClient } from './client.js';
import { prompts } from './prompts.js';
import { designPlanSchema } from './schemas.js';
export class OpenAIDesignPlanner implements DesignPlanner {
  constructor(private readonly client: StructuredOpenAIClient) {}
  plan(
    input: Parameters<DesignPlanner['plan']>[0],
    context: Parameters<DesignPlanner['plan']>[1],
  ) {
    return this.client.generate(
      'design_plan',
      prompts.design,
      input,
      designPlanSchema,
      context.signal,
    );
  }
}
