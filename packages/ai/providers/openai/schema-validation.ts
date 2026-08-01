import { zodResponseFormat } from 'openai/helpers/zod';
import type { z } from 'zod';

type JsonSchema = Record<string, unknown>;

/** Validate the exact JSON Schema representation submitted to OpenAI strict mode. */
export function validateOpenAISchema(
  name: string,
  schema: z.ZodType,
): JsonSchema {
  const jsonSchema = zodResponseFormat(schema, name).json_schema
    .schema as JsonSchema;

  const visit = (node: unknown, path: string): void => {
    if (!node || typeof node !== 'object') return;
    const value = node as JsonSchema;
    const properties = value.properties as JsonSchema | undefined;
    if (properties) {
      const required = new Set(
        Array.isArray(value.required) ? (value.required as string[]) : [],
      );
      for (const [key, child] of Object.entries(properties)) {
        if (!required.has(key))
          throw new Error(
            `OpenAI structured output schema field at ${path}/properties/${key} is not required`,
          );
        visit(child, `${path}/properties/${key}`);
      }
      if (value.additionalProperties !== false)
        throw new Error(
          `OpenAI structured output object at ${path} must set additionalProperties to false`,
        );
    }
    if (value.items) visit(value.items, `${path}/items`);
    for (const keyword of ['anyOf', 'oneOf', 'allOf'] as const) {
      const alternatives = value[keyword];
      if (Array.isArray(alternatives))
        alternatives.forEach((child, index) =>
          visit(child, `${path}/${keyword}/${index}`),
        );
    }
    const definitions = value.definitions as JsonSchema | undefined;
    if (definitions)
      for (const [key, child] of Object.entries(definitions))
        visit(child, `#/definitions/${key}`);
  };

  visit(jsonSchema, '#');
  return jsonSchema;
}
