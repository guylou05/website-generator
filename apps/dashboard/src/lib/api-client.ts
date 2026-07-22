export interface GenerationEvent {
  id: string;
  stage: string;
  eventType: string;
  progress: number | null;
  message: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}
export interface GenerationRun {
  id: string;
  projectId: string;
  provider: 'mock' | 'openai';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  currentStage: string | null;
  progress: number;
  input: Record<string, unknown>;
  output: {
    blueprint?: { valid?: boolean; pages?: unknown[] };
    elementor?: { status?: string };
    summary?: {
      pages_generated?: number;
      blueprint_valid?: boolean;
      elementor_ready?: boolean;
    };
  } | null;
  error: { code: string; message: string } | null;
  events: GenerationEvent[];
  createdAt: string;
}
export interface Project {
  id: string;
  name: string;
  slug: string;
  status: string;
  businessProfile: Record<string, unknown>;
  brandSettings: Record<string, unknown> | null;
  generationRuns: GenerationRun[];
  createdAt: string;
  updatedAt: string;
}
interface Wire {
  id: string | number;
  name: string;
  slug: string;
  status: string;
  business_profile: Record<string, unknown>;
  brand_settings: Record<string, unknown> | null;
  generation_runs?: Wire[];
  project_id: string;
  provider: string;
  current_stage: string | null;
  progress: number;
  input: Record<string, unknown>;
  output: GenerationRun['output'];
  error: GenerationRun['error'];
  events?: Wire[];
  stage: string;
  event_type: string;
  message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}
const mapEvent = (x: Wire): GenerationEvent => ({
  id: String(x.id),
  stage: x.stage,
  eventType: x.event_type,
  progress: x.progress,
  message: x.message,
  metadata: x.metadata,
  createdAt: x.created_at,
});
export const mapGeneration = (x: Wire): GenerationRun => ({
  id: String(x.id),
  projectId: x.project_id,
  provider: x.provider as GenerationRun['provider'],
  status: x.status as GenerationRun['status'],
  currentStage: x.current_stage,
  progress: x.progress,
  input: x.input,
  output: x.output,
  error: x.error,
  events: (x.events ?? []).map(mapEvent),
  createdAt: x.created_at,
});
export const mapProject = (x: Wire): Project => ({
  id: String(x.id),
  name: x.name,
  slug: x.slug,
  status: x.status,
  businessProfile: x.business_profile,
  brandSettings: x.brand_settings,
  generationRuns: (x.generation_runs ?? []).map(mapGeneration),
  createdAt: x.created_at,
  updatedAt: x.updated_at,
});

export class DashboardApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
export class DashboardApiClient {
  constructor(
    private readonly baseUrl = process.env.NEXT_PUBLIC_API_URL ??
      'http://localhost:8080/api',
    private readonly request: typeof fetch = fetch,
  ) {}
  private async call<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await this.request(`${this.baseUrl}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
      cache: 'no-store',
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      throw new DashboardApiError(
        body?.error?.message ?? 'API request failed.',
        response.status,
      );
    }
    if (response.status === 204) return null as T;
    const envelope = (await response.json()) as { data: T };
    return envelope.data;
  }
  async projects(): Promise<Project[]> {
    return (await this.call<Wire[]>('/projects')).map(mapProject);
  }
  async project(id: string): Promise<Project> {
    return mapProject(await this.call<Wire>(`/projects/${id}`));
  }
  async createProject(input: {
    name: string;
    business_profile: Record<string, unknown>;
    brand_settings?: Record<string, unknown>;
  }): Promise<Project> {
    return mapProject(
      await this.call<Wire>('/projects', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    );
  }
  async createGeneration(
    projectId: string,
    input: Record<string, unknown>,
  ): Promise<GenerationRun> {
    return mapGeneration(
      await this.call<Wire>(`/projects/${projectId}/generations`, {
        method: 'POST',
        body: JSON.stringify({ input }),
      }),
    );
  }
  async retryGeneration(id: string): Promise<GenerationRun> {
    return mapGeneration(
      await this.call<Wire>(`/generations/${id}/retry`, { method: 'POST' }),
    );
  }
  async cancelGeneration(id: string): Promise<GenerationRun> {
    return mapGeneration(
      await this.call<Wire>(`/generations/${id}/cancel`, { method: 'POST' }),
    );
  }
}
export const dashboardApi = new DashboardApiClient();
