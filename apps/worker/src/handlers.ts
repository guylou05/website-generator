import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';

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
import {
  InternalApiError,
  type InternalApiClient,
  type JobKind,
} from './internal-api.js';
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
    wordpress_connection: {
      url: string;
      authentication_type: unknown;
      username: unknown;
      application_password: unknown;
      connector_token: unknown;
    };
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
  async deployment(id: string, attempt = 1): Promise<void> {
    const claim = await this.api.post<{ data: { claimed?: boolean } }>(
      'deployments',
      id,
      'started',
      {
        worker_id: this.workerId,
        attempt,
        idempotency_key: `deployment:${id}:attempt:${attempt}`,
      },
    );
    if (claim.data.claimed === false) {
      logger.info('Duplicate or terminal deployment job ignored', {
        deploymentId: id,
        attempt,
      });
      return;
    }
    const context = await this.api.get<DeploymentContext>(
      'deployments',
      id,
      'execution-context',
    );
    const stop = this.heartbeat('deployments', id);
    try {
      await this.cancelGuard('deployments', id);
      const { wordpress_connection: wordpress, generation_output: output } =
        context.data;
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
      const authentication =
        wordpress.authentication_type === 'connector'
          ? { type: 'connector' as const, token: wordpress.connector_token }
          : wordpress.authentication_type === 'application_password'
            ? {
                type: 'application_password' as const,
                username: wordpress.username,
                applicationPassword: wordpress.application_password,
              }
            : ({ type: wordpress.authentication_type } as never);
      const client = new WordPressClient({
        url: wordpress.url,
        authentication,
      });
      const deployer = new WordPressDeployer(client);
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
      await client.testConnection();
      await stageEvent('verify_connection', 'stage.completed', 1);
      await this.cancelGuard('deployments', id);
      await stageEvent('capture_rollback_snapshot', 'stage.started', 1);
      const rollback = context.data.plan?.snapshot;
      if (!rollback)
        throw new Error('Approved rollback source snapshot is missing');
      await this.persistRollbackSnapshot(id, rollback);
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
  private async persistRollbackSnapshot(
    id: string,
    snapshot: Record<string, unknown>,
  ): Promise<void> {
    const serialized = Buffer.from(JSON.stringify(snapshot));
    const compressed = gzipSync(serialized);
    const checksum = createHash('sha256').update(serialized).digest('hex');
    const metrics = snapshotMetrics(snapshot, serialized.byteLength);
    logger.info('Rollback snapshot prepared', {
      deploymentId: id,
      ...metrics,
      compressedSizeBytes: compressed.byteLength,
    });
    const init = await this.api.post<{
      data: { upload_id: string; chunk_size_bytes: number };
    }>('deployments', id, 'rollback-snapshot/init', {
      checksum,
      uncompressed_size: serialized.byteLength,
      compressed_size: compressed.byteLength,
      content_type: 'application/json',
      content_encoding: 'gzip',
      schema_version: '1.0',
      metrics,
    });
    const chunkSize = init.data.chunk_size_bytes;
    for (
      let offset = 0, sequence = 0;
      offset < compressed.length;
      offset += chunkSize, sequence += 1
    ) {
      const chunk = compressed.subarray(offset, offset + chunkSize);
      await this.api.post('deployments', id, 'rollback-snapshot/chunks', {
        upload_id: init.data.upload_id,
        sequence,
        checksum: createHash('sha256').update(chunk).digest('hex'),
        data: chunk.toString('base64'),
      });
    }
    if (!gunzipSync(compressed).equals(serialized))
      throw new Error('Rollback snapshot compression verification failed');
    await this.api.post('deployments', id, 'rollback-snapshot/complete', {
      upload_id: init.data.upload_id,
    });
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
    const apiDetails =
      error instanceof InternalApiError
        ? safeApiDetails(error.details)
        : undefined;
    const providerError = findOpenAIError(error);
    const validation = error instanceof BlueprintValidationError;
    await this.api.post(kind, id, 'failed', {
      code: cancelled
        ? 'cancelled'
        : validation
          ? error.code
          : error instanceof InternalApiError && error.details.status === 413
            ? 'rollback_snapshot_too_large'
            : (providerError?.details.code ?? details.name),
      message: providerError?.message ?? details.message,
      details: validation
        ? error.details
        : (providerError?.details ?? apiDetails ?? details),
      cancelled,
    });
  }
}

function safeApiDetails(
  details: Record<string, unknown>,
): Record<string, unknown> {
  const responseBody =
    typeof details.responseBody === 'string' ? details.responseBody : '';
  let diagnostic: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(responseBody) as {
      error?: Record<string, unknown>;
    };
    diagnostic = parsed.error ?? {};
  } catch {
    /* The response may be a proxy-generated plain-text error. */
  }
  return {
    status: details.status,
    retryable: details.retryable,
    classification: details.classification,
    ...diagnostic,
  };
}

function snapshotMetrics(snapshot: Record<string, unknown>, sizeBytes: number) {
  const pages = Array.isArray(snapshot.pages) ? snapshot.pages : [];
  const elementor = (snapshot.elementor_documents ??
    snapshot.elementor ??
    []) as unknown;
  const elementorBytes = Buffer.byteLength(JSON.stringify(elementor));
  const counts: Record<string, number> = {
    pages: Buffer.byteLength(JSON.stringify(pages)),
    elementor_documents: elementorBytes,
    seo_metadata: Buffer.byteLength(JSON.stringify(snapshot.seo ?? {})),
    menus: Buffer.byteLength(JSON.stringify(snapshot.menus ?? [])),
    media_references: Buffer.byteLength(JSON.stringify(snapshot.media ?? [])),
    site_settings: Buffer.byteLength(
      JSON.stringify(snapshot.site_settings ?? {}),
    ),
  };
  return {
    size_bytes: sizeBytes,
    page_count: pages.length,
    elementor_json_bytes: elementorBytes,
    media_metadata_count: Array.isArray(snapshot.media)
      ? snapshot.media.length
      : 0,
    menu_count: Array.isArray(snapshot.menus) ? snapshot.menus.length : 0,
    largest_resource_type:
      Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'manifest',
  };
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
