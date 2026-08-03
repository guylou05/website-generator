import type Redis from 'ioredis';
import { z } from 'zod';
import { logger } from './logger.js';
import {
  DeploymentConflictError,
  InternalApiError,
  PermanentApiError,
} from './internal-api.js';

const transportJobSchema = z
  .object({
    id: z.string().uuid(),
    type: z.enum(['generation', 'deployment', 'media']),
    resource_id: z.string().uuid(),
    attempt: z.number().int().positive(),
    created_at: z.string().datetime({ offset: true }),
    idempotency_key: z.string().min(1).max(255),
  })
  .strict();
export type TransportJob = z.infer<typeof transportJobSchema>;

export type QueueConfig = {
  generation: string;
  deployment: string;
  media: string;
  prefix: string;
};

export function queueKey(config: QueueConfig, name: string): string {
  return `${config.prefix}:queue:${name}`;
}

export function decodeJob(payload: string): TransportJob {
  return transportJobSchema.parse(JSON.parse(payload));
}

export async function consumeOne(
  redis: Redis,
  config: QueueConfig,
  queueName: string,
  workerId: string,
  processJob: (job: TransportJob) => Promise<void>,
): Promise<boolean> {
  const ready = queueKey(config, queueName);
  const reserved = `${ready}:reserved`;
  const payload = await redis.brpoplpush(ready, reserved, 1);
  if (!payload) return false;
  let validEnvelope = false;
  try {
    const job = decodeJob(payload);
    validEnvelope = true;
    if (
      (queueName === config.generation && job.type !== 'generation') ||
      (queueName === config.deployment && job.type !== 'deployment') ||
      (queueName === config.media && job.type !== 'media')
    ) {
      throw new Error('Job type does not match queue');
    }
    logger.info('Queue job received', {
      type: job.type,
      resourceId: job.resource_id,
      queue: queueName,
    });
    const lock = `${config.prefix}:job-lock:${job.idempotency_key}`;
    if (await redis.set(lock, workerId, 'EX', 300, 'NX')) {
      try {
        await processJob(job);
        await redis.del(`${config.prefix}:published:${job.idempotency_key}`);
      } catch (error) {
        if (error instanceof InternalApiError && error.retryable) {
          const delayMs = retryDelayMs(job.attempt);
          logger.error('Internal API request will be retried', {
            deploymentId:
              job.type === 'deployment' ? job.resource_id : undefined,
            resourceId: job.resource_id,
            status: error.details.status,
            apiErrorCode: error.details.code,
            decision: 'retry',
            retryDelayMs: delayMs,
          });
          await sleep(delayMs);
          await redis.lpush(ready, payload);
        } else {
          const permanent = error instanceof PermanentApiError;
          logger.info(
            error instanceof DeploymentConflictError
              ? 'Deployment conflict'
              : 'Queue job discarded',
            {
              deploymentId:
                job.type === 'deployment' ? job.resource_id : undefined,
              resourceId: job.resource_id,
              status: permanent ? error.details.status : undefined,
              apiErrorCode: permanent
                ? error.details.code
                : 'unexpected_worker_error',
              decision: 'discard',
            },
          );
        }
      } finally {
        if ((await redis.get(lock)) === workerId) await redis.del(lock);
      }
    } else {
      logger.info('Duplicate job ignored', {
        type: job.type,
        resourceId: job.resource_id,
      });
    }
  } catch (error) {
    logger.error('Worker job failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    if (!validEnvelope) {
      await redis.lpush(`${ready}:stale`, payload);
    }
  } finally {
    await redis.lrem(reserved, 1, payload);
  }
  return true;
}

export function retryDelayMs(attempt: number): number {
  return Math.min(30_000, 1_000 * 2 ** Math.max(0, attempt - 1));
}

const sleep = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));
