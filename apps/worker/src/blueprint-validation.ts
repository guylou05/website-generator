import { createHash } from 'node:crypto';
import type { z } from 'zod';
import {
  BLUEPRINT_SCHEMA_VERSION,
  safeBlueprintIssues,
} from '@website-generator/shared/schema';

export class BlueprintValidationError extends Error {
  readonly code = 'blueprint_validation_failed';
  readonly details;
  constructor(
    readonly validation: z.ZodError,
    invalidOutput: unknown,
  ) {
    super('The generated website structure did not pass validation.');
    this.name = 'BlueprintValidationError';
    this.details = {
      code: this.code,
      stage: 'blueprint',
      schema_version: BLUEPRINT_SCHEMA_VERSION,
      issues: safeBlueprintIssues(validation).map((issue) => ({
        ...issue,
        path: issue.path.join('.'),
      })),
      issue_count: validation.issues.length,
      output_hash: createHash('sha256')
        .update(JSON.stringify(invalidOutput))
        .digest('hex'),
    };
  }
}
