import {
  applicationPasswordAuthorization,
  normalizeWordPressUrl,
} from './auth.js';
import {
  WordPressApiError,
  WordPressAuthenticationError,
  WordPressConfigurationError,
  WordPressTimeoutError,
} from './errors.js';
import type {
  ConnectionTestResult,
  WordPressClientOptions,
  WordPressCredentials,
  WordPressLogger,
} from './types.js';

const noopLogger: WordPressLogger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};
export interface WordPressRequestOptions {
  readonly query?: Readonly<
    Record<string, string | number | boolean | readonly string[] | undefined>
  >;
  readonly body?: unknown;
  readonly headers?: Readonly<Record<string, string>>;
  readonly rawBody?: BodyInit;
  readonly retry?: boolean;
}

export class WordPressClient {
  readonly baseUrl: string;
  private readonly authorization: string;
  private readonly fetchImplementation: typeof fetch;
  private readonly timeoutMs: number;
  private readonly maxAttempts: number;
  private readonly logger: WordPressLogger;

  constructor(
    credentials: WordPressCredentials,
    options: WordPressClientOptions = {},
  ) {
    this.baseUrl = normalizeWordPressUrl(credentials.url);
    this.authorization = applicationPasswordAuthorization(credentials);
    this.fetchImplementation = options.fetch ?? globalThis.fetch;
    if (!this.fetchImplementation)
      throw new WordPressConfigurationError(
        'A Fetch API implementation is required',
      );
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.maxAttempts = options.maxAttempts ?? 3;
    if (
      this.timeoutMs < 1 ||
      !Number.isInteger(this.maxAttempts) ||
      this.maxAttempts < 1
    )
      throw new WordPressConfigurationError(
        'timeoutMs and maxAttempts must be positive',
      );
    this.logger = options.logger ?? noopLogger;
  }

  async testConnection(): Promise<ConnectionTestResult> {
    const user = await this.request<{
      id: number;
      slug: string;
      capabilities: Record<string, boolean>;
    }>('/wp-json/wp/v2/users/me', { query: { context: 'edit' } });
    if (!user.capabilities?.manage_options)
      throw new WordPressAuthenticationError(
        'Authenticated WordPress user must have administrator capabilities',
        403,
      );
    return {
      success: true,
      userId: user.id,
      username: user.slug,
      capabilities: user.capabilities,
    };
  }

  async request<T>(
    path: string,
    options: WordPressRequestOptions = {},
    method = 'GET',
  ): Promise<T> {
    const url = new URL(path, `${this.baseUrl}/`);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value === undefined) continue;
      for (const item of Array.isArray(value) ? value : [value])
        url.searchParams.append(key, String(item));
    }
    const attempts =
      options.retry === false || !['GET', 'PUT', 'DELETE'].includes(method)
        ? 1
        : this.maxAttempts;
    let lastError: unknown;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      this.logger.debug('WordPress request started', { method, path, attempt });
      try {
        const response = await this.fetchImplementation(url, {
          method,
          signal: controller.signal,
          headers: {
            Authorization: this.authorization,
            Accept: 'application/json',
            ...(options.body === undefined
              ? {}
              : { 'Content-Type': 'application/json' }),
            ...options.headers,
          },
          ...(options.rawBody === undefined ? {} : { body: options.rawBody }),
          ...(options.body === undefined
            ? {}
            : { body: JSON.stringify(options.body) }),
        });
        clearTimeout(timer);
        const payload = await parseResponse(response);
        if (!response.ok) {
          const message = isApiError(payload)
            ? payload.message
            : `WordPress returned HTTP ${response.status}`;
          const code = isApiError(payload) ? payload.code : undefined;
          if (response.status === 401 || response.status === 403)
            throw new WordPressAuthenticationError(message, response.status);
          throw new WordPressApiError(
            message,
            method,
            path,
            response.status,
            code,
          );
        }
        return payload as T;
      } catch (error) {
        clearTimeout(timer);
        const normalized = controller.signal.aborted
          ? new WordPressTimeoutError(this.timeoutMs, { cause: error })
          : error;
        lastError = normalized;
        if (
          normalized instanceof WordPressAuthenticationError ||
          attempt === attempts ||
          !isRetryable(normalized)
        )
          throw normalized;
        this.logger.warn('WordPress request failed; retrying', {
          method,
          path,
          attempt,
          delayMs: retryDelay(attempt),
          error:
            normalized instanceof Error
              ? normalized.message
              : String(normalized),
        });
        await new Promise((resolve) =>
          setTimeout(resolve, retryDelay(attempt)),
        );
      }
    }
    throw new WordPressApiError(
      'Request failed',
      method,
      path,
      undefined,
      undefined,
      { cause: lastError },
    );
  }

  get<T>(path: string, options?: WordPressRequestOptions): Promise<T> {
    return this.request(path, options, 'GET');
  }
  post<T>(
    path: string,
    body?: unknown,
    options: WordPressRequestOptions = {},
  ): Promise<T> {
    return this.request(path, { ...options, body }, 'POST');
  }
  put<T>(
    path: string,
    body?: unknown,
    options: WordPressRequestOptions = {},
  ): Promise<T> {
    return this.request(path, { ...options, body }, 'PUT');
  }
}

async function parseResponse(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
function isApiError(
  value: unknown,
): value is { code: string; message: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    typeof value.message === 'string' &&
    'code' in value &&
    typeof value.code === 'string'
  );
}
function isRetryable(error: unknown): boolean {
  return (
    error instanceof WordPressTimeoutError ||
    error instanceof TypeError ||
    (error instanceof WordPressApiError &&
      (!error.status || error.status === 429 || error.status >= 500))
  );
}
function retryDelay(attempt: number): number {
  return Math.min(250 * 2 ** (attempt - 1), 2_000);
}
