import { createHash, randomUUID } from 'node:crypto';
import { gzip, gunzipSync } from 'node:zlib';
import { promisify } from 'node:util';

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
    attempt: number;
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
class LeaseLost extends Error {
  readonly code = 'lease_lost';
}
const gzipAsync = promisify(gzip);
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
    const claim = await this.api.post<{
      data: { claimed?: boolean; lease_token?: string };
    }>('generations', id, 'started', {
      worker_id: this.workerId,
    });
    if (claim.data.claimed === false || !claim.data.lease_token) return;
    const leaseToken = claim.data.lease_token;
    const heartbeat = this.heartbeat('generations', id, leaseToken);
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
        lease_token: leaseToken,
        completion_idempotency_key: `generation:${id}:attempt:${context.data.attempt}`,
        completion_checksum: createHash('sha256')
          .update(
            JSON.stringify({
              blueprint: validation.data,
              elementor: { status: 'ready', documents },
            }),
          )
          .digest('hex'),
        output: {
          blueprint: validation.data,
          elementor: {
            status: 'ready',
            documents,
          },
        },
      });
      logger.info('Blueprint persistence and generation completion completed', {
        generationRunId: id,
      });
    } catch (error) {
      if (error instanceof InternalApiError) throw error;
      const providerError = findOpenAIError(error);
      logger.error('Generation failed with exception', {
        generationRunId: id,
        ...(providerError?.details ?? {}),
        error: serializeException(error),
      });
      await this.fail('generations', id, error);
    } finally {
      heartbeat.stop();
    }
  }
  async deployment(id: string, attempt = 1): Promise<void> {
    const claim = await this.api.post<{
      data: { claimed?: boolean; lease_token?: string };
    }>('deployments', id, 'started', {
      worker_id: this.workerId,
      attempt,
      idempotency_key: `deployment:${id}:attempt:${attempt}`,
    });
    if (claim.data.claimed === false) {
      logger.info('Duplicate or terminal deployment job ignored', {
        deploymentId: id,
        attempt,
      });
      return;
    }
    const leaseToken = claim.data.lease_token;
    if (!leaseToken) return;
    await this.api.post('deployments', id, 'running', {
      lease_token: leaseToken,
    });
    const context = await this.api.get<DeploymentContext>(
      'deployments',
      id,
      'execution-context',
    );
    const heartbeat = this.heartbeat('deployments', id, leaseToken);
    try {
      await this.cancelGuard('deployments', id);
      const { wordpress_connection: wordpress, generation_output: output } =
        context.data;
      if (
        !output?.blueprint?.pages ||
        output.elementor?.documents === undefined
      )
        throw new Error('Generation output is invalid');
      heartbeat.assertOwned();
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
          event_uuid: deterministicEventId(id, stage, eventType),
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
      await this.persistRollbackSnapshot(id, rollback, leaseToken, heartbeat.assertOwned);
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
        lease_token: leaseToken,
        completion_idempotency_key: `deployment:${id}:attempt:${attempt}`,
        completion_checksum: createHash('sha256')
          .update(JSON.stringify(result))
          .digest('hex'),
        operations: result.operations,
        result: { ...result, site_url: wordpress.url },
      });
    } catch (error) {
      if (error instanceof LeaseLost || heartbeat.lost()) {
        logger.error('Deployment stopped after lease ownership was lost', { deploymentId: id, errorCode: 'lease_lost' });
        return;
      }
      if (error instanceof InternalApiError) throw error;
      await this.fail('deployments', id, error);
    } finally {
      heartbeat.stop();
    }
  }
  private async persistRollbackSnapshot(
    id: string,
    snapshot: Record<string, unknown>,
    leaseToken: string,
    assertOwned: () => void,
  ): Promise<void> {
    const stageStarted = Date.now();
    const serialized = Buffer.from(JSON.stringify(snapshot));
    const compressed = await gzipAsync(serialized);
    assertOwned();
    const checksum = createHash('sha256').update(serialized).digest('hex');
    const metrics = snapshotMetrics(snapshot, serialized.byteLength);
    logger.info('Rollback snapshot prepared', {
      deploymentId: id,
      ...metrics,
      compressedSizeBytes: compressed.byteLength,
    });
    const init = await this.api.post<{
      data: { upload_id: string; chunk_size_bytes: number; completed_chunks: number[]; verified?: boolean };
    }>('deployments', id, 'rollback-snapshot/init', {
      lease_token: leaseToken,
      checksum,
      uncompressed_size: serialized.byteLength,
      compressed_size: compressed.byteLength,
      content_type: 'application/json',
      content_encoding: 'gzip',
      schema_version: '1.0',
      metrics,
    });
    const chunkSize = init.data.chunk_size_bytes;
    const totalChunks = Math.ceil(compressed.length / chunkSize);
    const completed = new Set(init.data.completed_chunks ?? []);
    logger.info('Snapshot upload initialized', { deploymentId: id, totalChunks, byteSize: compressed.byteLength, durationMs: Date.now() - stageStarted, errorCode: null });
    for (
      let offset = 0, sequence = 0;
      offset < compressed.length;
      offset += chunkSize, sequence += 1
    ) {
      assertOwned();
      const chunk = compressed.subarray(offset, offset + chunkSize);
      if (completed.has(sequence)) {
        logger.info('Snapshot chunk already persisted; skipping', { deploymentId: id, chunkNumber: sequence + 1, totalChunks, byteSize: chunk.byteLength, durationMs: 0, errorCode: null });
        continue;
      }
      const chunkStarted = Date.now();
      logger.info('Snapshot chunk started', { deploymentId: id, chunkNumber: sequence + 1, totalChunks, byteSize: chunk.byteLength, durationMs: 0, errorCode: null });
      await this.api.post('deployments', id, 'rollback-snapshot/chunks', {
        lease_token: leaseToken,
        upload_id: init.data.upload_id,
        sequence,
        checksum: createHash('sha256').update(chunk).digest('hex'),
        data: chunk.toString('base64'),
      });
      logger.info('Snapshot chunk completed', { deploymentId: id, chunkNumber: sequence + 1, totalChunks, byteSize: chunk.byteLength, durationMs: Date.now() - chunkStarted, errorCode: null });
    }
    if (!gunzipSync(compressed).equals(serialized))
      throw new Error('Rollback snapshot compression verification failed');
    assertOwned();
    logger.info('Snapshot upload completed', { deploymentId: id, totalChunks, byteSize: compressed.byteLength, durationMs: Date.now() - stageStarted, errorCode: null });
    await this.api.post('deployments', id, 'rollback-snapshot/complete', {
      lease_token: leaseToken,
      upload_id: init.data.upload_id,
    });
    assertOwned();
    logger.info('Snapshot checksum verified', { deploymentId: id, totalChunks, byteSize: serialized.byteLength, durationMs: Date.now() - stageStarted, errorCode: null });
    logger.info('Snapshot manifest persisted', { deploymentId: id, totalChunks, byteSize: serialized.byteLength, durationMs: Date.now() - stageStarted, errorCode: null });
    logger.info('Snapshot stage completed', { deploymentId: id, totalChunks, byteSize: serialized.byteLength, durationMs: Date.now() - stageStarted, errorCode: null });
  }
  private heartbeat(kind: JobKind, id: string, leaseToken: string) {
    let stopped = false;
    let inFlight = false;
    let leaseLost = false;
    const beat = async () => {
      if (stopped || inFlight || leaseLost) return;
      inFlight = true;
      try { await this.api.post(kind, id, 'heartbeat', { lease_token: leaseToken }); }
      catch (error) {
        const status = error instanceof InternalApiError ? error.details.status : undefined;
        logger.error('Worker heartbeat failed', { jobKind: kind, jobId: id, errorCode: status === 409 ? 'lease_lost' : 'heartbeat_failed' });
        if (status === 409) leaseLost = true;
      } finally { inFlight = false; }
    };
    void beat();
    const timer = setInterval(() => void beat(), this.heartbeatMs);
    return { stop: () => { stopped = true; clearInterval(timer); }, lost: () => leaseLost, assertOwned: () => { if (leaseLost) throw new LeaseLost('Deployment lease ownership was lost'); } };
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
      error instanceof InternalApiError ? safeApiDetails(error) : undefined;
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

function safeApiDetails(error: InternalApiError): Record<string, unknown> {
  const details = error.details;
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
    retryable: error.retryable,
    classification: error.retryable
      ? 'retryable_transient_error'
      : 'permanent_api_error',
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

function deterministicEventId(deploymentId: string, stage: string, eventType: string): string {
  const hex = createHash('sha256').update(`${deploymentId}:${stage}:${eventType}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
