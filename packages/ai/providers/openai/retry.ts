import type { RetryPolicy } from '../../orchestrator/retry.js';
import { OpenAIProviderError } from './client.js';

const retryableStatuses = new Set([429, 500, 502, 503, 504]);
const nonRetryableTypes = new Set([
  'invalid_request_error',
  'authentication_error',
]);

export class OpenAIRetryPolicy implements RetryPolicy {
  readonly maxAttempts: number;

  constructor(
    maxRetries: number,
    private readonly initialDelayMs = 250,
  ) {
    this.maxAttempts = maxRetries + 1;
  }

  shouldRetry(error: unknown): boolean {
    return (
      error instanceof OpenAIProviderError &&
      error.details.status !== undefined &&
      !nonRetryableTypes.has(error.details.type ?? '') &&
      retryableStatuses.has(error.details.status)
    );
  }

  delayMs(attempt: number): number {
    return Math.min(this.initialDelayMs * 2 ** (attempt - 1), 5_000);
  }
}
