import type { BlueprintGenerator } from '../../orchestrator/contracts.js';
import type { StructuredOpenAIClient } from './client.js';
import { prompts } from './prompts.js';
import { z } from 'zod';
import {
  normalizeBlueprint,
  safeBlueprintIssues,
  type SafeBlueprintIssue,
} from '@website-generator/shared/schema';
import {
  openAIWebsiteBlueprintSchema,
  siteBlueprintSchema,
} from './schemas.js';

export class BlueprintTransportValidationError extends Error {
  constructor(
    readonly issues: SafeBlueprintIssue[],
    cause: unknown,
  ) {
    super('OpenAI blueprint transport failed validation', { cause });
    this.name = 'BlueprintTransportValidationError';
  }
}

export class BlueprintDomainValidationError extends Error {
  constructor(
    readonly issues: SafeBlueprintIssue[],
    cause: unknown,
  ) {
    super('Blueprint failed canonical domain validation', { cause });
    this.name = 'BlueprintDomainValidationError';
  }
}

export class OpenAIBlueprintGenerator implements BlueprintGenerator {
  constructor(private readonly client: StructuredOpenAIClient) {}
  async generate(
    input: Parameters<BlueprintGenerator['generate']>[0],
    context: Parameters<BlueprintGenerator['generate']>[1],
  ) {
    let generated: unknown;
    try {
      generated = await this.client.generate(
        'website_blueprint',
        prompts.blueprint,
        input,
        openAIWebsiteBlueprintSchema,
        context.signal,
      );
    } catch (error) {
      if (error instanceof z.ZodError)
        throw new BlueprintTransportValidationError(
          safeBlueprintIssues(error),
          error,
        );
      throw error;
    }
    const normalized = normalizeBlueprint(generated).value;
    const validation = siteBlueprintSchema.safeParse(normalized);
    if (validation.success) return validation.data;

    const issues = safeBlueprintIssues(validation.error);
    let repaired: unknown;
    try {
      repaired = await this.client.generate(
        'website_blueprint_repair',
        `${prompts.blueprint}\nRepair only the exact canonical validation issues supplied. Preserve all valid normalized fields. Return a complete blueprint satisfying the canonical schema.`,
        { source: input, normalizedBlueprint: normalized, issues },
        openAIWebsiteBlueprintSchema,
        context.signal,
      );
    } catch (error) {
      if (error instanceof z.ZodError)
        throw new BlueprintTransportValidationError(
          safeBlueprintIssues(error),
          error,
        );
      throw error;
    }
    const finalValue = normalizeBlueprint(repaired).value;
    const finalValidation = siteBlueprintSchema.safeParse(finalValue);
    if (!finalValidation.success)
      throw new BlueprintDomainValidationError(
        safeBlueprintIssues(finalValidation.error),
        finalValidation.error,
      );
    return finalValidation.data;
  }
  async repair(
    input: Parameters<NonNullable<BlueprintGenerator['repair']>>[0],
    invalidBlueprint: unknown,
    issues: Parameters<NonNullable<BlueprintGenerator['repair']>>[2],
    context: Parameters<NonNullable<BlueprintGenerator['repair']>>[3],
  ) {
    let generated: unknown;
    try {
      generated = await this.client.generate(
        'website_blueprint_repair',
        `${prompts.blueprint}\nCorrect the supplied blueprint. Change only fields required by these validation issues: ${JSON.stringify(issues)}.`,
        { source: input, invalidBlueprint },
        openAIWebsiteBlueprintSchema,
        context.signal,
      );
    } catch (error) {
      if (error instanceof z.ZodError)
        throw new BlueprintTransportValidationError(
          safeBlueprintIssues(error),
          error,
        );
      throw error;
    }
    const normalized = normalizeBlueprint(generated).value;
    const validation = siteBlueprintSchema.safeParse(normalized);
    if (!validation.success)
      throw new BlueprintDomainValidationError(
        safeBlueprintIssues(validation.error),
        validation.error,
      );
    return validation.data;
  }
}
