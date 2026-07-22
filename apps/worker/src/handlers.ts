import { randomUUID } from 'node:crypto';

/* eslint-disable @typescript-eslint/no-explicit-any -- callback data crosses a validated JSON API boundary */
import {
  MockAiProvider,
  WebsiteGenerationOrchestrator,
  createOpenAIProvider,
} from '@website-generator/ai';
import {
  WordPressClient,
  WordPressDeployer,
} from '@website-generator/wordpress';
import type { InternalApiClient, JobKind } from './internal-api.js';

type GenerationContext = {
  data: {
    id: string;
    project_id: string;
    provider: 'mock' | 'openai';
    input: Record<string, unknown>;
    business_profile: Record<string, unknown>;
  };
};
type DeploymentContext = {
  data: {
    id: string;
    dry_run: boolean;
    generation_output: {
      blueprint: any;
      elementor: { documents: Array<{ page: string; elements: unknown }> };
    };
    wordpress: { url: string; username: string; application_password: string };
  };
};
class Cancelled extends Error {}
export class JobHandlers {
  constructor(
    private readonly api: InternalApiClient,
    private readonly workerId: string,
    private readonly heartbeatMs: number,
  ) {}
  async generation(id: string): Promise<void> {
    const context = await this.api.get<GenerationContext>(
      'generations',
      id,
      'execution-context',
    );
    await this.api.post('generations', id, 'started', {
      worker_id: this.workerId,
    });
    const stop = this.heartbeat('generations', id);
    try {
      const mock = new MockAiProvider(
        mockResponses(context.data.business_profile),
      );
      const provider =
        context.data.provider === 'openai' ? createOpenAIProvider() : mock;
      const orchestrator = new WebsiteGenerationOrchestrator({
        projects: {
          getProfile: async () => context.data.business_profile as any,
        },
        ...provider,
        createRunId: () => id,
        reporter: {
          report: async (event) => {
            await this.cancelGuard('generations', id);
            await this.api.post('generations', id, 'events', {
              event_uuid: randomUUID(),
              stage: event.progress.stage,
              event_type: event.type,
              progress: event.progress.percentage,
              message: event.type.replaceAll('.', ' '),
              metadata: { attempt: event.progress.attempt },
            });
          },
        },
      });
      const result = await orchestrator.generateWebsite(
        context.data.project_id,
      );
      await this.cancelGuard('generations', id);
      await this.api.post('generations', id, 'completed', {
        output: {
          blueprint: result.blueprint,
          elementor: {
            status: 'ready',
            documents: (result.blueprint.pages ?? []).map((p: any) => ({
              page: p.id,
              elements: [],
            })),
          },
          summary: { pages_generated: result.blueprint.pages?.length ?? 0 },
        },
      });
    } catch (error) {
      await this.fail('generations', id, error);
    } finally {
      stop();
    }
  }
  async deployment(id: string): Promise<void> {
    const context = await this.api.get<DeploymentContext>(
      'deployments',
      id,
      'execution-context',
    );
    await this.api.post('deployments', id, 'started', {
      worker_id: this.workerId,
    });
    const stop = this.heartbeat('deployments', id);
    try {
      await this.cancelGuard('deployments', id);
      const { wordpress, generation_output: output } = context.data;
      if (
        !output?.blueprint?.pages ||
        output.elementor?.documents === undefined
      )
        throw new Error('Generation output is invalid');
      await this.api.post('deployments', id, 'events', {
        event_uuid: randomUUID(),
        stage: 'deployment',
        event_type: 'deployment.started',
        progress: 10,
        message: 'WordPress deployment started',
      });
      await this.cancelGuard('deployments', id);
      const deployer = new WordPressDeployer(
        new WordPressClient({
          url: wordpress.url,
          username: wordpress.username,
          applicationPassword: wordpress.application_password,
        }),
      );
      const elementorPages = Object.fromEntries(
        output.elementor.documents.map((d) => [d.page, d.elements]),
      ) as any;
      const result = await deployer.deploy({
        blueprint: output.blueprint,
        elementorPages,
        dryRun: context.data.dry_run,
      });
      await this.cancelGuard('deployments', id);
      await this.api.post('deployments', id, 'completed', {
        operations: result.operations,
        result: { ...result, site_url: wordpress.url },
      });
    } catch (error) {
      await this.fail('deployments', id, error);
    } finally {
      stop();
    }
  }
  private heartbeat(kind: JobKind, id: string): () => void {
    const timer = setInterval(
      () => void this.api.post(kind, id, 'heartbeat').catch(() => {}),
      this.heartbeatMs,
    );
    return () => clearInterval(timer);
  }
  private async cancelGuard(kind: JobKind, id: string): Promise<void> {
    const state = await this.api.get<{ cancelled: boolean }>(
      kind,
      id,
      'cancellation-status',
    );
    if (state.cancelled) throw new Cancelled('Cancellation requested');
  }
  private async fail(kind: JobKind, id: string, error: unknown): Promise<void> {
    const cancelled = error instanceof Cancelled;
    await this.api.post(kind, id, 'failed', {
      code: cancelled ? 'cancelled' : 'job_failed',
      message: cancelled
        ? 'Job cancelled.'
        : 'The job could not be completed. Please retry.',
      cancelled,
    });
  }
}
function mockResponses(profile: Record<string, unknown>): any {
  const name = String(profile.businessName ?? 'Website');
  return {
    analysis: {
      summary: name,
      industry: 'Services',
      audiences: [],
      offerings: [],
      valueProposition: 'Quality service',
      goals: [],
      recommendedTone: [],
      constraints: [],
    },
    plan: {
      strategy: 'Convert visitors',
      primaryGoal: 'Contact',
      navigation: [],
      pages: [],
    },
    content: { pages: {} },
    seo: { siteTitle: name, pages: {} },
    design: {
      direction: 'Clean',
      colors: {},
      typography: {},
      globalStyles: {},
      pageLayouts: {},
    },
    blueprint: {
      schemaVersion: '1.0',
      site: { name, locale: 'en' },
      branding: {},
      navigation: { items: [] },
      pages: [],
    },
  };
}
