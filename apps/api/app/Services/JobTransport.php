<?php

namespace App\Services;

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
        $payload = json_encode([
            'version' => 1,
            'type' => $type,
            'uuid' => $uuid,
            'attempt' => $attempt,
            'enqueued_at' => now()->toIso8601String(),
        ], JSON_THROW_ON_ERROR);

        Redis::connection(config('job_transport.redis_connection'))->lpush($this->key($queue), $payload);
    }
}
