<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Redis;

/**
 * Language-neutral Redis list transport shared with apps/worker.
 *
 * Producers LPUSH a JSON envelope and consumers atomically BRPOPLPUSH it to a
 * reserved list. The payload intentionally contains no PHP serialization.
 */
class JobTransport
{
    public function generation(string $uuid, int $attempt = 1): void
    {
        $this->enqueue('generation', $uuid, config('job_transport.generation_queue'), $attempt);
    }

    public function media(string $uuid, int $attempt = 1): void
    {
        $this->enqueue('media', $uuid, config('job_transport.media_queue'), $attempt);
    }

    public function deployment(string $uuid, int $attempt = 1): void
    {
        $this->enqueue('deployment', $uuid, config('job_transport.deployment_queue'), $attempt);
    }

    public function key(string $queue, bool $reserved = false): string
    {
        return config('job_transport.prefix').':queue:'.$queue.($reserved ? ':reserved' : '');
    }

    private function enqueue(string $type, string $uuid, string $queue, int $attempt): void
    {
        $idempotencyKey = $type === 'deployment' ? "deployment:{$uuid}" : "{$type}:{$uuid}:{$attempt}";
        $payload = json_encode([
            'id' => $uuid,
            'type' => $type,
            'resource_id' => $uuid,
            'attempt' => $attempt,
            'created_at' => now()->toIso8601String(),
            'idempotency_key' => $idempotencyKey,
        ], JSON_THROW_ON_ERROR);

        $redis = Redis::connection(config('job_transport.redis_connection'));
        $published = $redis->eval(
            "if redis.call('SET', KEYS[1], '1', 'NX', 'EX', 120) then redis.call('LPUSH', KEYS[2], ARGV[1]); return 1 else return 0 end",
            2,
            config('job_transport.prefix').':published:'.$idempotencyKey,
            $this->key($queue),
            $payload,
        );
        Log::info($published ? 'Interoperable job published' : 'Duplicate active job publish skipped', [
            'resource_id' => $uuid, 'job_type' => $type, 'queue' => $queue,
        ]);
    }
}
