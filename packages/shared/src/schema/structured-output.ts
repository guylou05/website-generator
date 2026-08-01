import { z } from 'zod';

/**
 * A field that is nullable in generated JSON while retaining the historical
 * `undefined` application value (and accepting omitted fields from old data).
 */
export const nullableOptional = <T extends z.ZodTypeAny>(schema: T) =>
  z
    .preprocess(
      (value) => (value === undefined ? null : value),
      schema.nullable(),
    )
    .transform((value) => value ?? undefined);
