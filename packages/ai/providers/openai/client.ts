import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import type { z } from 'zod';
import type { OpenAIProviderConfig } from './config.js';
import { SYSTEM_PROMPT } from './prompts.js';

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
    schema: z.ZodType<T>,
    signal?: AbortSignal,
  ): Promise<T>;
  readonly usage: readonly UsageMetadata[];
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
        maxRetries: config.maxRetries,
      });
  }
  async generate<T>(
    name: string,
    prompt: string,
    input: unknown,
    schema: z.ZodType<T>,
    signal?: AbortSignal,
  ): Promise<T> {
    try {
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
          response_format: zodResponseFormat(schema, name),
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
      if (error instanceof OpenAI.APIConnectionTimeoutError)
        throw new Error('The AI service timed out. Please try again.');
      if (error instanceof OpenAI.RateLimitError)
        throw new Error('The AI service is busy. Please try again shortly.');
      if (error instanceof OpenAI.AuthenticationError)
        throw new Error('The AI service is not configured correctly.');
      if (
        error instanceof Error &&
        (error.message.startsWith('The model') || error.name === 'AbortError')
      )
        throw error;
      throw new Error(
        'The AI service could not complete this request. Please try again.',
      );
    }
  }
}
