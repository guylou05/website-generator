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
export interface WordPressConnection {
  id: string;
  projectId: string;
  siteUrl: string;
  username: string;
  status: 'unverified' | 'verified' | 'failed';
  wordpressVersion: string | null;
  elementorVersion: string | null;
  connectorVersion: string | null;
  lastError: { code: string; message: string } | null;
}
export interface Deployment {
  id: string;
  projectId: string;
  generationRunId: string;
  wordpressConnectionId: string;
  status: string;
  dryRun: boolean;
  progress: number;
  currentStage: string | null;
  operations: Array<{
    action: string;
    resource: string;
    identifier: string;
    details?: Record<string, unknown>;
  }> | null;
  result: { site_url?: string; admin_url?: string } | null;
  error: { code: string; message: string } | null;
  events: GenerationEvent[];
}
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  email_verified_at: string | null;
  current_organization: Organization | null;
  current_role: MembershipRole | null;
}
export type MembershipRole = 'owner' | 'admin' | 'member' | 'viewer';
export interface Organization {
  id: string;
  name: string;
  slug: string;
  owner_user_id: string;
  memberships?: OrganizationMembership[];
}
export interface OrganizationMembership {
  id: string;
  organization_id: string;
  user_id: string;
  role: MembershipRole;
  status: string;
  user?: Pick<AuthUser, 'id' | 'name' | 'email'>;
}
export interface OrganizationInvitation {
  id: string;
  organization_id: string;
  email: string;
  role: Exclude<MembershipRole, 'owner'>;
  expires_at: string;
  invitation_url?: string;
}
export interface BillingPlan {
  key: 'free' | 'starter' | 'pro' | 'agency';
  name: string;
  recommended: boolean;
  available: { monthly: boolean; yearly: boolean };
  entitlements: {
    members: number;
    projects: number;
    generations: number;
    live_deployments: number;
    wordpress_connections: number;
    providers: string[];
  };
}
export interface BillingSummary {
  current_plan: BillingPlan['key'];
  subscription: null | {
    status: string;
    billing_interval: string;
    current_period_end: string | null;
    cancel_at: string | null;
    trial_ends_at: string | null;
    grace_ends_at: string | null;
  };
  limits: Record<string, number>;
}
export interface BillingUsage {
  period_start: string;
  period_end: string;
  metrics: Record<string, { used: number; limit: number; remaining: number }>;
}
export interface MediaAsset {
  id: string;
  project_id: string | null;
  source_type: string;
  status: string;
  display_name: string;
  description: string | null;
  alt_text: string | null;
  caption: string | null;
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  url: string | null;
  usage_count?: number;
  provider_attribution?: Record<string, unknown> | null;
}
export interface ImageGenerationJob {
  id: string;
  project_id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'canceled';
  prompt: string;
  aspect_ratio: string;
  requested_count: number;
  generated_count: number;
  error: Record<string, unknown> | null;
}
export interface BrandKit {
  id: string;
  project_id: string | null;
  name: string;
  is_default: boolean;
  primary_color: string;
  image_style: Record<string, unknown> | null;
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
  site_url?: string;
  username?: string;
  wordpress_version?: string | null;
  elementor_version?: string | null;
  connector_version?: string | null;
  last_error?: WordPressConnection['lastError'];
  generation_run_id?: string;
  wordpress_connection_id?: string;
  dry_run?: boolean;
  operations?: Deployment['operations'];
  result?: Deployment['result'];
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
export const mapConnection = (x: Wire): WordPressConnection => ({
  id: String(x.id),
  projectId: x.project_id,
  siteUrl: x.site_url ?? '',
  username: x.username ?? '',
  status: x.status as WordPressConnection['status'],
  wordpressVersion: x.wordpress_version ?? null,
  elementorVersion: x.elementor_version ?? null,
  connectorVersion: x.connector_version ?? null,
  lastError: x.last_error ?? null,
});
export const mapDeployment = (x: Wire): Deployment => ({
  id: String(x.id),
  projectId: x.project_id,
  generationRunId: x.generation_run_id ?? '',
  wordpressConnectionId: x.wordpress_connection_id ?? '',
  status: x.status,
  dryRun: x.dry_run ?? false,
  progress: x.progress,
  currentStage: x.current_stage,
  operations: x.operations ?? null,
  result: x.result ?? null,
  error: x.error,
  events: (x.events ?? []).map(mapEvent),
});

export class DashboardApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code = 'request_failed',
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}
export class DashboardApiClient {
  private readonly request: typeof fetch;

  constructor(
    private readonly baseUrl = process.env.NEXT_PUBLIC_API_URL?.trim().replace(
      /\/$/,
      '',
    ) || 'http://localhost:8080/api',
    request?: typeof fetch,
  ) {
    this.request =
      request ??
      ((input: RequestInfo | URL, init?: RequestInit) =>
        globalThis.fetch(input, init));
  }
  private csrfReady = false;
  async initializeCsrf(): Promise<void> {
    if (this.csrfReady) return;
    const origin = this.baseUrl.replace(/\/api\/?$/, '');
    const response = await this.request(`${origin}/sanctum/csrf-cookie`, {
      credentials: 'include',
      cache: 'no-store',
    });
    if (!response.ok)
      throw new DashboardApiError(
        'Could not initialize the secure session.',
        response.status,
        'csrf_failed',
      );
    this.csrfReady = true;
  }
  private async call<T>(path: string, init?: RequestInit): Promise<T> {
    if (init?.method && !['GET', 'HEAD'].includes(init.method))
      await this.initializeCsrf();
    const response = await this.request(`${this.baseUrl}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
      cache: 'no-store',
      credentials: 'include',
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as {
        error?: {
          message?: string;
          code?: string;
          details?: Record<string, string[]>;
        };
      };
      throw new DashboardApiError(
        body?.error?.message ?? 'API request failed.',
        response.status,
        body.error?.code,
        body.error?.details,
      );
    }
    if (response.status === 204) return null as T;
    const envelope = (await response.json()) as { data: T };
    return envelope.data;
  }
  register(input: {
    name: string;
    email: string;
    password: string;
    password_confirmation: string;
    organization_name?: string;
  }): Promise<AuthUser> {
    return this.call('/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }
  login(input: {
    email: string;
    password: string;
    remember?: boolean;
  }): Promise<AuthUser> {
    return this.call('/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }
  logout(): Promise<null> {
    return this.call('/auth/logout', { method: 'POST' });
  }
  currentUser(): Promise<AuthUser> {
    return this.call('/auth/user');
  }
  forgotPassword(email: string) {
    return this.call<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }
  resetPassword(input: {
    email: string;
    token: string;
    password: string;
    password_confirmation: string;
  }) {
    return this.call<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }
  organizations(): Promise<Organization[]> {
    return this.call('/organizations');
  }
  createOrganization(name: string): Promise<Organization> {
    return this.call('/organizations', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }
  switchOrganization(id: string): Promise<Organization> {
    return this.call(`/organizations/${id}/switch`, { method: 'POST' });
  }
  members(id: string): Promise<OrganizationMembership[]> {
    return this.call(`/organizations/${id}/members`);
  }
  invitations(id: string): Promise<OrganizationInvitation[]> {
    return this.call(`/organizations/${id}/invitations`);
  }
  invite(
    id: string,
    input: { email: string; role: Exclude<MembershipRole, 'owner'> },
  ): Promise<OrganizationInvitation> {
    return this.call(`/organizations/${id}/invitations`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
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
  async connections(projectId: string): Promise<WordPressConnection[]> {
    return (
      await this.call<Wire[]>(`/projects/${projectId}/wordpress-connections`)
    ).map(mapConnection);
  }
  async createConnection(
    projectId: string,
    input: { site_url: string; username: string; application_password: string },
  ): Promise<WordPressConnection> {
    return mapConnection(
      await this.call<Wire>(`/projects/${projectId}/wordpress-connections`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    );
  }
  async verifyConnection(id: string): Promise<WordPressConnection> {
    return mapConnection(
      await this.call<Wire>(`/wordpress-connections/${id}/verify`, {
        method: 'POST',
      }),
    );
  }
  async deployments(projectId: string): Promise<Deployment[]> {
    return (await this.call<Wire[]>(`/projects/${projectId}/deployments`)).map(
      mapDeployment,
    );
  }
  async previewDeployment(
    projectId: string,
    input: { generation_run_id: string; wordpress_connection_id: string },
  ): Promise<Deployment> {
    return mapDeployment(
      await this.call<Wire>(`/projects/${projectId}/deployments/preview`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    );
  }
  async deploy(
    projectId: string,
    input: { generation_run_id: string; wordpress_connection_id: string },
  ): Promise<Deployment> {
    return mapDeployment(
      await this.call<Wire>(`/projects/${projectId}/deployments`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    );
  }
  async retryDeployment(id: string): Promise<Deployment> {
    return mapDeployment(
      await this.call<Wire>(`/deployments/${id}/retry`, { method: 'POST' }),
    );
  }
  async cancelDeployment(id: string): Promise<Deployment> {
    return mapDeployment(
      await this.call<Wire>(`/deployments/${id}/cancel`, { method: 'POST' }),
    );
  }
  getPlans(): Promise<BillingPlan[]> {
    return this.call('/billing/plans');
  }
  getBillingSummary(): Promise<BillingSummary> {
    return this.call('/billing/summary');
  }
  getUsage(): Promise<BillingUsage> {
    return this.call('/billing/usage');
  }
  createCheckoutSession(input: {
    plan_key: BillingPlan['key'];
    billing_interval: 'monthly' | 'yearly';
    success_url: string;
    cancel_url: string;
  }): Promise<{ url: string; plan_key: string; billing_interval: string }> {
    return this.call('/billing/checkout-session', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }
  createPortalSession(return_url: string): Promise<{ url: string }> {
    return this.call('/billing/portal-session', {
      method: 'POST',
      body: JSON.stringify({ return_url }),
    });
  }
  changePlan(
    plan_key: BillingPlan['key'],
    billing_interval: 'monthly' | 'yearly',
  ) {
    return this.call('/billing/change-plan', {
      method: 'POST',
      body: JSON.stringify({ plan_key, billing_interval }),
    });
  }
  cancelSubscription() {
    return this.call('/billing/cancel-subscription', { method: 'POST' });
  }
  resumeSubscription() {
    return this.call('/billing/resume-subscription', { method: 'POST' });
  }
  initiateUpload(input: {
    filename: string;
    mime_type: string;
    size_bytes: number;
    project_id?: string;
    display_name?: string;
  }) {
    return this.call<{
      asset: MediaAsset;
      upload: {
        url: string;
        headers: Record<string, string>;
        expires_at: string;
      };
    }>('/media/uploads', { method: 'POST', body: JSON.stringify(input) });
  }
  completeUpload(id: string) {
    return this.call<MediaAsset>(`/media/uploads/${id}/complete`, {
      method: 'POST',
    });
  }
  abortUpload(id: string) {
    return this.call<null>(`/media/uploads/${id}/abort`, { method: 'POST' });
  }
  listMedia(query = '') {
    return this.call<{ data: MediaAsset[]; next_cursor?: string }>(
      `/media${query ? `?${query}` : ''}`,
    );
  }
  getMedia(id: string) {
    return this.call<MediaAsset>(`/media/${id}`);
  }
  updateMedia(
    id: string,
    input: Partial<
      Pick<MediaAsset, 'display_name' | 'description' | 'alt_text' | 'caption'>
    >,
  ) {
    return this.call<MediaAsset>(`/media/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }
  deleteMedia(id: string) {
    return this.call<null>(`/media/${id}`, { method: 'DELETE' });
  }
  restoreMedia(id: string) {
    return this.call<MediaAsset>(`/media/${id}/restore`, { method: 'POST' });
  }
  reprocessMedia(id: string) {
    return this.call<MediaAsset>(`/media/${id}/reprocess`, { method: 'POST' });
  }
  transformMedia(id: string, input: Record<string, unknown>) {
    return this.call<MediaAsset>(`/media/${id}/transformations`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }
  startImageGeneration(projectId: string, input: Record<string, unknown>) {
    return this.call<ImageGenerationJob>(
      `/projects/${projectId}/image-generations`,
      { method: 'POST', body: JSON.stringify(input) },
    );
  }
  listImageGenerations(projectId: string) {
    return this.call<ImageGenerationJob[]>(
      `/projects/${projectId}/image-generations`,
    );
  }
  getImageGeneration(id: string) {
    return this.call<ImageGenerationJob>(`/image-generations/${id}`);
  }
  cancelImageGeneration(id: string) {
    return this.call<ImageGenerationJob>(`/image-generations/${id}/cancel`, {
      method: 'POST',
    });
  }
  retryImageGeneration(id: string) {
    return this.call<ImageGenerationJob>(`/image-generations/${id}/retry`, {
      method: 'POST',
    });
  }
  searchStockImages(query: string) {
    return this.call(`/stock-images/search?${query}`);
  }
  importStockImage(input: Record<string, unknown>) {
    return this.call('/stock-images/import', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }
  suggestAltText(id: string, input: Record<string, unknown> = {}) {
    return this.call<{ proposal: string }>(`/media/${id}/suggest-alt-text`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }
  listBrandKits() {
    return this.call<BrandKit[]>('/brand-kits');
  }
  createBrandKit(input: Partial<BrandKit>) {
    return this.call<BrandKit>('/brand-kits', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }
  updateBrandKit(id: string, input: Partial<BrandKit>) {
    return this.call<BrandKit>(`/brand-kits/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }
  assignBrandKit(projectId: string, brand_kit_id: string) {
    return this.call(`/projects/${projectId}/brand-kit`, {
      method: 'POST',
      body: JSON.stringify({ brand_kit_id }),
    });
  }
  manageBrandAssets(id: string, input: Record<string, unknown>) {
    return this.call(`/brand-kits/${id}/assets`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }
}
export const dashboardApi = new DashboardApiClient();
