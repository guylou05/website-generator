import { hostname } from 'node:os';
import Redis from 'ioredis';
import { InternalApiClient } from './internal-api.js';
import { JobHandlers } from './handlers.js';
import { logger } from './logger.js';

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
};
const redis = new Redis(required('REDIS_URL'), { maxRetriesPerRequest: null });
const api = new InternalApiClient(
  required('API_INTERNAL_BASE_URL'),
  required('INTERNAL_WORKER_TOKEN'),
);
const workerId = `${hostname()}-${process.pid}`;
const handlers = new JobHandlers(
  api,
  workerId,
  Number(process.env.JOB_HEARTBEAT_INTERVAL_MS ?? 15_000),
);
const concurrency = Math.max(1, Number(process.env.WORKER_CONCURRENCY ?? 2));
let stopping = false;
async function consume(): Promise<void> {
  while (!stopping) {
    const payload = await redis.brpoplpush(
      'queues:default',
      'queues:default:reserved',
      2,
    );
    if (!payload) continue;
    try {
      const parsed = JSON.parse(payload) as {
        displayName?: string;
        data?: { command?: string };
      };
      const command = parsed.data?.command ?? '';
      const id = command.match(/[0-9a-f]{8}-[0-9a-f-]{27,}/i)?.[0];
      const kind = parsed.displayName?.includes('GenerateWebsite')
        ? 'generation'
        : parsed.displayName?.includes('DeployWebsite')
          ? 'deployment'
          : null;
      if (!id || !kind) {
        logger.error('Unsupported queue payload');
        continue;
      }
      const lock = `job-lock:${kind}:${id}`;
      if (await redis.set(lock, workerId, 'EX', 300, 'NX')) {
        try {
          if (kind === 'generation') await handlers.generation(id);
          else await handlers.deployment(id);
        } finally {
          if ((await redis.get(lock)) === workerId) await redis.del(lock);
        }
      } else logger.info('Duplicate job ignored', { kind, id });
    } catch (error) {
      logger.error('Worker job failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      await redis.lrem('queues:default:reserved', 1, payload);
    }
  }
}
const tasks = Array.from({ length: concurrency }, () => consume());
async function shutdown(signal: string): Promise<void> {
  if (stopping) return;
  stopping = true;
  logger.info('Graceful shutdown started', { signal });
  await Promise.all(tasks);
  await redis.quit();
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
logger.info('Website Generator worker ready', { workerId, concurrency });
