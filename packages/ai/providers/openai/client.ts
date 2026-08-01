import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import type { OpenAIProviderConfig } from './config.js';
import { SYSTEM_PROMPT } from './prompts.js';
import {
  assertNoSchemaFormats,
  prepareOpenAISchema,
  validateOpenAISchema,
} from './schema-validation.js';

export interface UsageMetadata {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}
export interface StructuredOpenAIClient {
  generate<T>(
    name: string,
    prompt: string,
    input: unknown,
    schema: z.ZodType<T, z.ZodTypeDef, unknown>,
    signal?: AbortSignal,
  ): Promise<T>;
  readonly usage: readonly UsageMetadata[];
}

export interface OpenAIErrorDetails {
  provider: 'openai';
  model: string;
  status?: number;
  type?: string;
  code?: string;
  message: string;
  requestId?: string;
  endpoint: string;
}

/** A lossless, serializable view of an error returned by OpenAI. */
export class OpenAIProviderError extends Error {
  readonly details: OpenAIErrorDetails;

  constructor(details: OpenAIErrorDetails, cause: unknown) {
    super(details.message, { cause });
    this.name = 'OpenAIProviderError';
    this.details = details;
  }
}

const endpoint = '/v1/chat/completions';

function providerError(error: unknown, model: string): OpenAIProviderError {
  const value = error as {
    status?: number;
    code?: string;
    type?: string;
    message?: string;
    request_id?: string;
    headers?: { get?(name: string): string | null };
    error?: { code?: string; type?: string; message?: string };
  };
  const body = value?.error;
  const requestId =
    value?.request_id ?? value?.headers?.get?.('x-request-id') ?? undefined;
  return new OpenAIProviderError(
    {
      provider: 'openai',
      model,
      ...(typeof value?.status === 'number' ? { status: value.status } : {}),
      ...((body?.type ?? value?.type)
        ? { type: body?.type ?? value.type }
        : {}),
      ...((body?.code ?? value?.code)
        ? { code: body?.code ?? value.code }
        : {}),
      message:
        body?.message ??
        value?.message ??
        (typeof error === 'string' ? error : String(error)),
      ...(requestId ? { requestId } : {}),
      endpoint,
    },
    error,
  );
}

export class OpenAIStructuredClient implements StructuredOpenAIClient {
  private readonly sdk: OpenAI;
  private readonly records: UsageMetadata[] = [];
  get usage(): readonly UsageMetadata[] {
    return this.records;
  }
  constructor(
    private readonly config: OpenAIProviderConfig,
    sdk?: OpenAI,
  ) {
    this.sdk =
      sdk ??
      new OpenAI({
        apiKey: config.apiKey,
        timeout: config.timeoutMs,
        // Pipeline retries are status-aware; SDK retries would also retry statuses
        // (such as 408/409) that are explicitly not safe for this worker.
        maxRetries: 0,
      });
  }
  async generate<T>(
    name: string,
    prompt: string,
    input: unknown,
    schema: z.ZodType<T, z.ZodTypeDef, unknown>,
    signal?: AbortSignal,
  ): Promise<T> {
    try {
      validateOpenAISchema(name, schema);
      const responseFormat = zodResponseFormat(schema, name);
      responseFormat.json_schema.schema = prepareOpenAISchema(
        responseFormat.json_schema.schema,
      );
      assertNoSchemaFormats(name, responseFormat.json_schema.schema);
      const completion = await this.sdk.chat.completions.parse(
        {
          model: this.config.model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            {
              role: 'user',
              content: `${prompt}\n\nInput JSON:\n${JSON.stringify(input)}`,
            },
          ],
          response_format: responseFormat,
        },
        signal ? { signal } : undefined,
      );
      if (completion.usage)
        this.records.push({
          inputTokens: completion.usage.prompt_tokens,
          outputTokens: completion.usage.completion_tokens,
          totalTokens: completion.usage.total_tokens,
        });
      const message = completion.choices[0]?.message;
      if (message?.refusal)
        throw new Error('The model declined this generation request');
      if (!message?.parsed)
        throw new Error('The model returned invalid structured output');
      return schema.parse(message.parsed);
    } catch (error) {
      // Parsing the SDK response against our local transport schema is not an
      // OpenAI service failure and must retain its validation classification.
      if (error instanceof z.ZodError) throw error;
      if (
        error instanceof Error &&
        (error.message.startsWith('The model') || error.name === 'AbortError')
      )
        throw error;
      if (error instanceof OpenAIProviderError) throw error;
      throw providerError(error, this.config.model);
    }
  }
}
