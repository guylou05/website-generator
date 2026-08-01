import { zodResponseFormat } from 'openai/helpers/zod';
import type { z } from 'zod';

type JsonSchema = Record<string, unknown>;

export interface SchemaFormatOccurrence {
  path: string;
  value: unknown;
}

export interface SchemaRefOccurrence {
  path: string;
  node: Record<string, unknown>;
}

/** Test/debug helper that reports the full JSON Pointer of every $ref node. */
export function findSchemaRefs(
  schema: unknown,
  path = '#',
): SchemaRefOccurrence[] {
  if (!schema || typeof schema !== 'object') return [];
  if (Array.isArray(schema))
    return schema.flatMap((child, index) =>
      findSchemaRefs(child, `${path}/${index}`),
    );
  const node = schema as JsonSchema;
  const found = Object.hasOwn(node, '$ref') ? [{ path, node }] : [];
  for (const [key, child] of Object.entries(node))
    found.push(
      ...findSchemaRefs(
        child,
        `${path}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`,
      ),
    );
  return found;
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

/** Clone a generated schema before attaching it to the SDK request. */
export function prepareOpenAISchema(schema: unknown): JsonSchema {
  const clone = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(clone);
    if (!node || typeof node !== 'object') return node;
    const result: JsonSchema = {};
    for (const [key, value] of Object.entries(node)) {
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
    if (Object.hasOwn(value, 'default'))
      throw new Error(
        `OpenAI structured output schema at ${path} contains unsupported default`,
      );
    if (Object.hasOwn(value, '$ref') && Object.keys(value).length !== 1)
      throw new Error(
        `OpenAI structured output $ref at ${path} has sibling keywords: ${Object.keys(
          value,
        )
          .filter((key) => key !== '$ref')
          .join(', ')}`,
      );
    if (Object.hasOwn(value, 'format'))
      throw new Error(
        `OpenAI structured output schema at ${path} contains unsupported format ${JSON.stringify(value.format)}`,
      );
    const properties = value.properties as JsonSchema | undefined;
    if (value.type === 'object' || properties) {
      const isMap =
        !properties &&
        value.additionalProperties !== null &&
        typeof value.additionalProperties === 'object';
      if (isMap) {
        throw new Error(
          `OpenAI structured output object at ${path} is an unsupported additionalProperties map`,
        );
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
        if (new Set(requiredKeys).size !== requiredKeys.length)
          throw new Error(
            `OpenAI structured output object at ${path}/required contains duplicate keys`,
          );
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
    // Traverse unrecognised schema containers too, so forbidden keywords can
    // never hide in a newly emitted JSON Schema keyword.
    const traversed = new Set([
      'properties',
      'items',
      'anyOf',
      'oneOf',
      'allOf',
      'definitions',
      '$defs',
    ]);
    for (const [key, child] of Object.entries(value)) {
      if (traversed.has(key) || child === null || typeof child !== 'object')
        continue;
      visit(
        child,
        `${path}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`,
      );
    }
  };

  visit(jsonSchema, '#');
  return jsonSchema;
}
