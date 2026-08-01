import type { z } from 'zod';
import { siteBlueprintSchema, type SiteBlueprint } from './site.js';

export type SafeBlueprintIssue = Pick<
  z.ZodIssue,
  'code' | 'message' | 'path'
> & { expected?: string; received?: string };

const clone = (value: unknown): unknown =>
  value === undefined ? undefined : JSON.parse(JSON.stringify(value));

/** Only removes fields explicitly rejected by the canonical strict schema. */
export function normalizeBlueprint(input: unknown): {
  value: unknown;
  applied: boolean;
} {
  const value = clone(input);
  let applied = false;
  for (let pass = 0; pass < 20; pass += 1) {
    const result = siteBlueprintSchema.safeParse(value);
    if (result.success) return { value: result.data, applied };
    const extras = result.error.issues.filter(
      (issue) => issue.code === 'unrecognized_keys',
    );
    if (!extras.length) break;
    for (const issue of extras) {
      let parent: unknown = value;
      for (const segment of issue.path)
        parent = (parent as Record<string | number, unknown>)?.[segment];
      if (parent && typeof parent === 'object')
        for (const key of issue.keys) {
          delete (parent as Record<string, unknown>)[key];
          applied = true;
        }
    }
  }
  return { value, applied };
}

export function safeBlueprintIssues(error: z.ZodError): SafeBlueprintIssue[] {
  return error.issues.map((issue) => {
    const typed = issue as z.ZodIssue & {
      expected?: string;
      received?: string;
    };
    return {
      path: issue.path,
      code: issue.code,
      message: issue.message,
      ...(typed.expected ? { expected: typed.expected } : {}),
      ...(typed.received ? { received: typed.received } : {}),
    };
  });
}

export const parseNormalizedBlueprint = (
  input: unknown,
): {
  blueprint: SiteBlueprint;
  normalized: boolean;
} => {
  const normalized = normalizeBlueprint(input);
  return {
    blueprint: siteBlueprintSchema.parse(normalized.value),
    normalized: normalized.applied,
  };
};
