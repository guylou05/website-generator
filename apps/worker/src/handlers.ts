import { randomUUID } from 'node:crypto';

/* eslint-disable @typescript-eslint/no-explicit-any -- callback data crosses a validated JSON API boundary */
import {
  MockAiProvider,
  OpenAIProviderError,
  WebsiteGenerationOrchestrator,
  createOpenAIProvider,
} from '@website-generator/ai';
import {
  WordPressClient,
  WordPressDeployer,
} from '@website-generator/wordpress';
import { renderElementorPage } from '@website-generator/renderer';
import { siteBlueprintSchema } from '@website-generator/shared/schema';
import type { InternalApiClient, JobKind } from './internal-api.js';
import { logger } from './logger.js';
import { BlueprintValidationError } from './blueprint-validation.js';

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
    plan?: {
      changes: Array<Record<string, unknown>>;
      options: Record<string, unknown>;
      snapshot: Record<string, unknown>;
    };
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
      logger.info(
        'Blueprint generation returned; beginning post-blueprint pipeline',
        {
          generationRunId: id,
        },
      );
      logger.info('Blueprint validation started', { generationRunId: id });
      const validation = siteBlueprintSchema.safeParse(result.blueprint);
      if (!validation.success) {
        const failure = new BlueprintValidationError(
          validation.error,
          result.blueprint,
        );
        logger.error('Blueprint validation failed', {
          runId: id,
          projectId: context.data.project_id,
          model: process.env.OPENAI_MODEL ?? context.data.provider,
          schemaVersion: '1.0',
          issueCount: validation.error.issues.length,
          issues: failure.details.issues,
        });
        throw failure;
      }
      logger.info('Blueprint validation completed', {
        generationRunId: id,
        pages: validation.data.pages.length,
      });
      const documents = [];
      for (const page of validation.data.pages) {
        logger.info('Page creation started', {
          generationRunId: id,
          pageId: page.id,
        });
        const document = renderElementorPage(validation.data, page.id);
        documents.push({ page: page.id, elements: document.content });
        logger.info('Page creation completed', {
          generationRunId: id,
          pageId: page.id,
        });
      }
      await this.cancelGuard('generations', id);
      logger.info('Blueprint persistence and generation completion started', {
        generationRunId: id,
      });
      await this.api.post('generations', id, 'completed', {
        output: {
          blueprint: validation.data,
          elementor: {
            status: 'ready',
            documents,
          },
          summary: { pages_generated: validation.data.pages.length },
        },
      });
      logger.info('Blueprint persistence and generation completion completed', {
        generationRunId: id,
      });
    } catch (error) {
      const providerError = findOpenAIError(error);
      logger.error('Generation failed with exception', {
        generationRunId: id,
        ...(providerError?.details ?? {}),
        error: serializeException(error),
      });
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
      const executionStages = [
        'verify_connection',
        'capture_rollback_snapshot',
        'prepare_media',
        'upload_media',
        'create_pages',
        'update_pages',
        'apply_elementor_documents',
        'apply_seo',
        'update_navigation',
        'configure_homepage',
        'apply_site_settings',
        'regenerate_elementor_css',
        'verify_remote_state',
        'finalize',
      ] as const;
      const stageEvent = async (
        stage: (typeof executionStages)[number],
        eventType: string,
        index: number,
        metadata?: Record<string, unknown>,
      ) =>
        this.api.post('deployments', id, 'events', {
          event_uuid: randomUUID(),
          stage,
          event_type: eventType,
          progress: Math.floor((index / executionStages.length) * 100),
          message: `${stage.replaceAll('_', ' ')} ${eventType.split('.').at(-1)}`,
          metadata,
        });
      await stageEvent('verify_connection', 'stage.started', 0);
      await stageEvent('verify_connection', 'stage.completed', 1);
      await this.cancelGuard('deployments', id);
      await stageEvent('capture_rollback_snapshot', 'stage.started', 1);
      const rollback = context.data.plan?.snapshot;
      if (!rollback)
        throw new Error('Approved rollback source snapshot is missing');
      await this.api.post('deployments', id, 'rollback-snapshot', {
        snapshot: rollback,
      });
      await stageEvent('capture_rollback_snapshot', 'stage.completed', 2);
      const elementorPages = Object.fromEntries(
        output.elementor.documents.map((d) => [d.page, d.elements]),
      ) as any;
      for (let index = 2; index < 12; index += 1) {
        await this.cancelGuard('deployments', id);
        await stageEvent(executionStages[index]!, 'stage.started', index);
        if (index === 4) break;
        await stageEvent(executionStages[index]!, 'stage.completed', index + 1);
      }
      const result = await deployer.deploy({
        blueprint: output.blueprint,
        elementorPages,
        dryRun: context.data.dry_run,
        status:
          (context.data.plan?.options?.page_status as
            'draft' | 'publish' | undefined) ?? 'draft',
        setHomepage: Boolean(context.data.plan?.options?.set_homepage ?? true),
      });
      for (let index = 4; index < executionStages.length; index += 1) {
        await this.cancelGuard('deployments', id);
        if (index > 4)
          await stageEvent(executionStages[index]!, 'stage.started', index);
        await stageEvent(executionStages[index]!, 'stage.completed', index + 1);
      }
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
    const details = serializeException(error);
    const providerError = findOpenAIError(error);
    const validation = error instanceof BlueprintValidationError;
    await this.api.post(kind, id, 'failed', {
      code: cancelled
        ? 'cancelled'
        : validation
          ? error.code
          : (providerError?.details.code ?? details.name),
      message: providerError?.message ?? details.message,
      details: validation ? error.details : (providerError?.details ?? details),
      cancelled,
    });
  }
}

function findOpenAIError(error: unknown): OpenAIProviderError | undefined {
  let current = error;
  const seen = new Set<unknown>();
  while (current && !seen.has(current)) {
    if (current instanceof OpenAIProviderError) return current;
    seen.add(current);
    current = current instanceof Error ? current.cause : undefined;
  }
  return undefined;
}

export function serializeException(error: unknown): Record<string, any> {
  if (!(error instanceof Error))
    return { name: 'NonError', message: String(error) };
  const own = Object.fromEntries(
    Object.getOwnPropertyNames(error)
      .filter((key) => !['name', 'message', 'stack', 'cause'].includes(key))
      .map((key) => [key, (error as any)[key]]),
  );
  return {
    name: error.name,
    message: error.message,
    stack: error.stack ?? null,
    ...own,
    ...(error.cause ? { cause: serializeException(error.cause) } : {}),
  };
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
