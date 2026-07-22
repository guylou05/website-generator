export interface OpenAIProviderConfig {
  apiKey: string;
  model: string;
  timeoutMs: number;
  maxRetries: number;
}

const integer = (value: string | undefined, fallback: number, name: string) => {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0)
    throw new Error(`${name} must be a non-negative integer`);
  return parsed;
};

/** Read only on the server. Do not import this provider from client components. */
export function readOpenAIConfig(
  environment: NodeJS.ProcessEnv = process.env,
): OpenAIProviderConfig {
  if (!environment.OPENAI_API_KEY)
    throw new Error('OpenAI is not configured on this server');
  return {
    apiKey: environment.OPENAI_API_KEY,
    model: environment.OPENAI_MODEL || 'gpt-4.1-mini',
    timeoutMs: integer(
      environment.OPENAI_TIMEOUT_MS,
      60_000,
      'OPENAI_TIMEOUT_MS',
    ),
    maxRetries: integer(
      environment.OPENAI_MAX_RETRIES,
      2,
      'OPENAI_MAX_RETRIES',
    ),
  };
}
