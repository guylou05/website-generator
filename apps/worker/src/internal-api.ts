export type JobKind = 'generations' | 'deployments';
export class InternalApiError extends Error {
  constructor(
    message: string,
    readonly details: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'InternalApiError';
  }
}
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
    let serializedBody: string | undefined;
    if (body !== undefined) {
      try {
        serializedBody = JSON.stringify(body);
      } catch (error) {
        throw new InternalApiError(
          'Internal API request serialization failed',
          {
            kind,
            id,
            action,
            serializationError: serializeError(error),
          },
        );
      }
    }
    const response = await fetch(
      `${this.baseUrl.replace(/\/$/, '')}/${kind}/${id}/${action}`,
      {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: 'application/json',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        ...(serializedBody === undefined ? {} : { body: serializedBody }),
      },
    );
    if (!response.ok) {
      const responseBody = await response.text();
      throw new InternalApiError(
        `Internal API returned HTTP ${response.status}`,
        {
          kind,
          id,
          action,
          status: response.status,
          retryable: response.status >= 500 || response.status === 429,
          responseBody,
        },
      );
    }
    return response.json() as Promise<T>;
  }
}

function serializeError(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) return { value: String(error) };
  return { name: error.name, message: error.message, stack: error.stack };
}
