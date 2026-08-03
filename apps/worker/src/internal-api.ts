export type JobKind = 'generations' | 'deployments';

export type ApiErrorDetails = {
  kind: JobKind;
  id: string;
  action: string;
  status?: number;
  code: string;
  responseBody?: string;
};

export abstract class InternalApiError extends Error {
  abstract readonly retryable: boolean;

  constructor(
    message: string,
    readonly details: ApiErrorDetails,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'InternalApiError';
  }
}

export class RetryableApiError extends InternalApiError {
  readonly retryable = true;

  constructor(
    message: string,
    details: ApiErrorDetails,
    options?: ErrorOptions,
  ) {
    super(message, details, options);
    this.name = 'RetryableApiError';
  }
}

export class PermanentApiError extends InternalApiError {
  readonly retryable = false;

  constructor(
    message: string,
    details: ApiErrorDetails,
    options?: ErrorOptions,
  ) {
    super(message, details, options);
    this.name = 'PermanentApiError';
  }
}

export class DeploymentConflictError extends PermanentApiError {
  constructor(message: string, details: ApiErrorDetails) {
    super(message, details);
    this.name = 'DeploymentConflictError';
  }
}

const RETRYABLE_HTTP_STATUSES = new Set([500, 502, 503, 504]);

export class InternalApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
  ) {}
  async get<T>(kind: JobKind, id: string, action: string): Promise<T> {
    return this.request<T>(kind, id, action);
  }
  async post<T>(
    kind: JobKind,
    id: string,
    action: string,
    body: unknown = {},
  ): Promise<T> {
    return this.request<T>(kind, id, action, body);
  }
  private async request<T>(
    kind: JobKind,
    id: string,
    action: string,
    body?: unknown,
  ): Promise<T> {
    const requestDetails = { kind, id, action };
    let serializedBody: string | undefined;
    if (body !== undefined) {
      try {
        serializedBody = JSON.stringify(body);
      } catch (error) {
        throw new PermanentApiError(
          'Internal API request serialization failed',
          { ...requestDetails, code: 'request_serialization_failed' },
          { cause: error },
        );
      }
    }

    let response: Response;
    try {
      response = await fetch(
        `${this.baseUrl.replace(/\/$/, '')}/${kind}/${id}/${action}`,
        {
          method: body === undefined ? 'GET' : 'POST',
          headers: {
            Authorization: `Bearer ${this.token}`,
            Accept: 'application/json',
            ...(body === undefined
              ? {}
              : { 'Content-Type': 'application/json' }),
          },
          ...(serializedBody === undefined ? {} : { body: serializedBody }),
        },
      );
    } catch (error) {
      throw new RetryableApiError(
        'Internal API network request failed',
        { ...requestDetails, code: networkErrorCode(error) },
        { cause: error },
      );
    }

    if (!response.ok) {
      const responseBody = await response.text();
      const code = apiErrorCode(response.status, responseBody);
      const details = {
        ...requestDetails,
        status: response.status,
        code,
        responseBody,
      };
      const message = `Internal API returned HTTP ${response.status}`;
      if (
        kind === 'deployments' &&
        action === 'started' &&
        response.status === 409
      )
        throw new DeploymentConflictError(message, details);
      if (RETRYABLE_HTTP_STATUSES.has(response.status))
        throw new RetryableApiError(message, details);
      throw new PermanentApiError(message, details);
    }
    return response.json() as Promise<T>;
  }
}

function apiErrorCode(status: number, body: string): string {
  try {
    const parsed = JSON.parse(body) as {
      error?: { code?: unknown };
      code?: unknown;
    };
    const code = parsed.error?.code ?? parsed.code;
    if (typeof code === 'string' && code.length > 0) return code;
  } catch {
    // Proxies may return text or HTML.
  }
  if (status === 409) return 'deployment_conflict';
  if (status === 413) return 'rollback_snapshot_too_large';
  return 'internal_api_error';
}

function networkErrorCode(error: unknown): string {
  if (error instanceof Error && error.name === 'AbortError')
    return 'network_timeout';
  const code =
    error instanceof Error && 'code' in error ? String(error.code) : '';
  return code === 'ECONNRESET' ? 'connection_reset' : 'network_error';
}
