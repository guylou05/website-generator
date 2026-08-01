import type Redis from 'ioredis';
import { logger } from './logger.js';

export type TransportJob = {
  version: 1;
  type: 'generation' | 'deployment';
  uuid: string;
  attempt: number;
  enqueued_at: string;
};

export type QueueConfig = {
  generation: string;
  deployment: string;
  prefix: string;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function queueKey(config: QueueConfig, name: string): string {
  return `${config.prefix}:queue:${name}`;
}

export function decodeJob(payload: string): TransportJob {
  const value: unknown = JSON.parse(payload);
  if (
    !value ||
    typeof value !== 'object' ||
    (value as Partial<TransportJob>).version !== 1 ||
    !['generation', 'deployment'].includes(
      String((value as Partial<TransportJob>).type),
    ) ||
    !uuidPattern.test(String((value as Partial<TransportJob>).uuid)) ||
    !Number.isInteger((value as Partial<TransportJob>).attempt) ||
    Number((value as Partial<TransportJob>).attempt) < 1 ||
    typeof (value as Partial<TransportJob>).enqueued_at !== 'string'
  ) {
    throw new Error('Unsupported interoperable queue payload');
  }
  return value as TransportJob;
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
      (queueName === config.deployment && job.type !== 'deployment')
    ) {
      throw new Error('Job type does not match queue');
    }
    logger.info('Queue job received', { type: job.type, uuid: job.uuid });
    const lock = `${config.prefix}:job-lock:${job.type}:${job.uuid}`;
    if (await redis.set(lock, workerId, 'EX', 300, 'NX')) {
      try {
        await processJob(job);
      } catch (error) {
        // An unexpected transport/process crash is retried. Domain failures are
        // reported to the API by JobHandlers and resolve normally.
        await redis.lpush(ready, payload);
        throw error;
      } finally {
        if ((await redis.get(lock)) === workerId) await redis.del(lock);
      }
    } else {
      logger.info('Duplicate job ignored', { type: job.type, uuid: job.uuid });
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
