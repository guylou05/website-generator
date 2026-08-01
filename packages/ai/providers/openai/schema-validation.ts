import { zodResponseFormat } from 'openai/helpers/zod';
import type { z } from 'zod';

type JsonSchema = Record<string, unknown>;

export interface SchemaFormatOccurrence {
  path: string;
  value: unknown;
}

/** Report every format keyword in a generated schema, including nested definitions. */
export function findSchemaFormats(
  schema: unknown,
  path = '#',
): SchemaFormatOccurrence[] {
  if (!schema || typeof schema !== 'object') return [];
  const occurrences: SchemaFormatOccurrence[] = [];
  if (!Array.isArray(schema) && Object.hasOwn(schema, 'format'))
    occurrences.push({ path, value: (schema as JsonSchema).format });
  for (const [key, child] of Object.entries(schema)) {
    const escapedKey = key.replaceAll('~', '~0').replaceAll('/', '~1');
    occurrences.push(...findSchemaFormats(child, `${path}/${escapedKey}`));
  }
  return occurrences;
}

/** Clone a schema for transport and strip string formats unsupported by OpenAI. */
export function prepareOpenAISchema(schema: unknown): JsonSchema {
  const clone = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(clone);
    if (!node || typeof node !== 'object') return node;
    const result: JsonSchema = {};
    for (const [key, value] of Object.entries(node)) {
      if (key === 'format' && (node as JsonSchema).type === 'string') continue;
      result[key] = clone(value);
    }
    return result;
  };
  return clone(schema) as JsonSchema;
}

export function assertNoSchemaFormats(name: string, schema: unknown): void {
  const occurrence = findSchemaFormats(schema)[0];
  if (occurrence)
    throw new Error(
      `${name} unsupported format:\n${occurrence.path}\nformat: ${String(occurrence.value)}`,
    );
}

/** Validate the exact JSON Schema representation submitted to OpenAI strict mode. */
export function validateOpenAISchema(
  name: string,
  schema: z.ZodType,
): JsonSchema {
  const generatedSchema = zodResponseFormat(schema, name).json_schema
    .schema as JsonSchema;
  const jsonSchema = prepareOpenAISchema(generatedSchema);
  assertNoSchemaFormats(name, jsonSchema);

  const visit = (node: unknown, path: string): void => {
    if (!node || typeof node !== 'object') return;
    const value = node as JsonSchema;
    const properties = value.properties as JsonSchema | undefined;
    if (value.type === 'object' || properties) {
      const isMap =
        !properties &&
        value.additionalProperties !== null &&
        typeof value.additionalProperties === 'object';
      if (isMap) {
        visit(value.additionalProperties, `${path}/additionalProperties`);
      } else {
        if (!properties)
          throw new Error(
            `OpenAI structured output object at ${path} must define properties`,
          );
        if (!Array.isArray(value.required))
          throw new Error(
            `OpenAI structured output object at ${path} must define required`,
          );

        const propertyKeys = Object.keys(properties);
        const requiredKeys = value.required as unknown[];
        const invalidRequiredKey = requiredKeys.find(
          (key) => typeof key !== 'string' || !(key in properties),
        );
        if (invalidRequiredKey !== undefined)
          throw new Error(
            `OpenAI structured output object at ${path}/required contains unknown property ${JSON.stringify(invalidRequiredKey)}`,
          );
        const required = new Set(requiredKeys);
        const missingRequiredKey = propertyKeys.find(
          (key) => !required.has(key),
        );
        if (missingRequiredKey)
          throw new Error(
            `OpenAI structured output schema field at ${path}/properties/${missingRequiredKey} is not required`,
          );

        for (const [key, child] of Object.entries(properties))
          visit(child, `${path}/properties/${key}`);

        if (value.additionalProperties !== false)
          throw new Error(
            `OpenAI structured output object at ${path} must set additionalProperties to false (except for maps)`,
          );
      }
    }
    if (value.items) visit(value.items, `${path}/items`);
    for (const keyword of ['anyOf', 'oneOf', 'allOf'] as const) {
      const alternatives = value[keyword];
      if (Array.isArray(alternatives))
        alternatives.forEach((child, index) =>
          visit(child, `${path}/${keyword}/${index}`),
        );
    }
    for (const keyword of ['definitions', '$defs'] as const) {
      const definitions = value[keyword] as JsonSchema | undefined;
      if (definitions)
        for (const [key, child] of Object.entries(definitions))
          visit(child, `${path}/${keyword}/${key}`);
    }
  };

  visit(jsonSchema, '#');
  return jsonSchema;
}
