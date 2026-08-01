<?php

namespace App\Console\Commands;

use App\Services\JobTransport;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Redis;
use Throwable;

class JobsDiagnose extends Command
{
    protected $signature = 'jobs:diagnose';

    protected $description = 'Diagnose the interoperable API-to-worker job transport';

    public function handle(JobTransport $transport): int
    {
        $redis = Redis::connection(config('job_transport.redis_connection'));
        $generation = config('job_transport.generation_queue');
        $deployment = config('job_transport.deployment_queue');
        $connected = false;
        $worker = null;
        $rows = [];

        try {
            $connected = (string) $redis->ping() !== '';
            $worker = json_decode($redis->get(config('job_transport.prefix').':worker:heartbeat') ?: 'null', true);
            $legacyDepth = $redis->llen('queues:default');
            $rows[] = ['legacy Laravel queue', $legacyDepth ? "$legacyDepth stale payload(s); run jobs:migrate-legacy --execute" : 'empty'];
            foreach ([$generation, $deployment] as $queue) {
                $key = $transport->key($queue);
                $oldest = $redis->lindex($key, -1);
                $envelope = $oldest ? json_decode($oldest, true) : null;
                $rows[] = ["queue $queue", $redis->llen($key).' ready / '.$redis->llen($transport->key($queue, true)).' reserved'];
                $rows[] = ["oldest $queue", $envelope ? (($envelope['enqueued_at'] ?? 'unknown').' ('.($envelope['uuid'] ?? 'invalid').')') : 'none'];
            }
        } catch (Throwable $error) {
            $rows[] = ['Redis error', $error->getMessage()];
        }

        $expected = ['database' => (int) env('REDIS_QUEUE_DB', env('REDIS_DB', 0)), 'generation_queue' => $generation, 'deployment_queue' => $deployment, 'prefix' => config('job_transport.prefix')];
        $actual = $worker ? array_intersect_key($worker, $expected) : null;
        $mismatch = $actual !== null && $actual !== $expected;
        array_unshift($rows, ['Redis connectivity', $connected ? 'ok' : 'failed'], ['Redis database', (string) $expected['database']], ['queue prefix', $expected['prefix']]);
        $rows[] = ['worker heartbeat', $worker['at'] ?? 'missing'];
        $rows[] = ['scheduler heartbeat', Cache::get('scheduler:heartbeat') ?? 'missing'];
        $rows[] = ['API/worker mismatch', $worker === null ? 'unknown (no worker heartbeat)' : ($mismatch ? 'YES '.json_encode(['api' => $expected, 'worker' => $actual]) : 'no')];
        $this->table(['Check', 'Value'], $rows);

        return ! $connected || $mismatch ? self::FAILURE : self::SUCCESS;
    }
}
