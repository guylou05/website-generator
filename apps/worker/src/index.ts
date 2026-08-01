import { hostname } from 'node:os';
import Redis from 'ioredis';
import { JobHandlers } from './handlers.js';
import { InternalApiClient } from './internal-api.js';
import { logger } from './logger.js';
import { consumeOne, type QueueConfig } from './queue.js';

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
};
const queueConfig: QueueConfig = {
  generation: process.env.GENERATION_QUEUE_NAME ?? 'website-generation',
  deployment: process.env.DEPLOYMENT_QUEUE_NAME ?? 'wordpress-deployment',
  media: process.env.MEDIA_QUEUE_NAME ?? 'media-processing',
  prefix: (process.env.REDIS_QUEUE_PREFIX ?? 'sitefoundry').replace(/:+$/, ''),
};
const redisDatabase = Number(process.env.REDIS_QUEUE_DB ?? 0);
const redis = new Redis(required('REDIS_URL'), {
  db: redisDatabase,
  maxRetriesPerRequest: null,
});
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
  const queues = [
    queueConfig.generation,
    queueConfig.deployment,
    queueConfig.media,
  ];
  let cursor = 0;
  while (!stopping) {
    const queue = queues[cursor++ % queues.length]!;
    await consumeOne(redis, queueConfig, queue, workerId, async (job) => {
      if (job.type === 'generation') await handlers.generation(job.resource_id);
      else if (job.type === 'deployment')
        await handlers.deployment(job.resource_id);
      else
        throw new Error(
          'Media execution is not yet available through the internal API',
        );
    });
  }
}

const heartbeatKey = `${queueConfig.prefix}:worker:heartbeat`;
const heartbeat = async (): Promise<void> => {
  await redis.set(
    heartbeatKey,
    JSON.stringify({
      at: new Date().toISOString(),
      worker_id: workerId,
      database: redisDatabase,
      generation_queue: queueConfig.generation,
      deployment_queue: queueConfig.deployment,
      media_queue: queueConfig.media,
      prefix: queueConfig.prefix,
    }),
    'EX',
    60,
  );
};
await heartbeat();
logger.info('Worker ready');
logger.info('Redis: connected');
logger.info(`Prefix: ${queueConfig.prefix}`);
logger.info('Queues', {
  queues: [queueConfig.generation, queueConfig.deployment, queueConfig.media],
});
const heartbeatTimer = setInterval(() => void heartbeat(), 15_000);
const tasks = Array.from({ length: concurrency }, () => consume());
async function shutdown(signal: string): Promise<void> {
  if (stopping) return;
  stopping = true;
  clearInterval(heartbeatTimer);
  logger.info('Graceful shutdown started', { signal });
  await Promise.all(tasks);
  await redis.quit();
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
logger.info('Website Generator worker ready', {
  workerId,
  concurrency,
  redisDatabase,
  generationQueue: queueConfig.generation,
  deploymentQueue: queueConfig.deployment,
  mediaQueue: queueConfig.media,
  queuePrefix: queueConfig.prefix,
});
