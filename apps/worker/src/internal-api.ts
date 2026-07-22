export type JobKind = 'generations' | 'deployments';
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
    const response = await fetch(
      `${this.baseUrl.replace(/\/$/, '')}/${kind}/${id}/${action}`,
      {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: 'application/json',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      },
    );
    if (!response.ok) {
      const error = new Error(`Internal API returned HTTP ${response.status}`);
      Object.assign(error, {
        status: response.status,
        retryable: response.status >= 500 || response.status === 429,
      });
      throw error;
    }
    return response.json() as Promise<T>;
  }
}
