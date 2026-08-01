<?php

namespace App\Console\Commands;

use App\Models\Deployment;
use App\Models\GenerationRun;
use App\Services\JobTransport;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Redis;

class MigrateLegacyJobs extends Command
{
    protected $signature = 'jobs:migrate-legacy {--execute : Re-enqueue queued records and archive Laravel payloads}';

    protected $description = 'Migrate queued records away from native serialized Laravel queue payloads';

    public function handle(JobTransport $transport): int
    {
        $generations = GenerationRun::where('status', 'queued')->count();
        $deployments = Deployment::where('status', 'queued')->count();
        if (! $this->option('execute')) {
            $this->warn("{$generations} generation(s) and {$deployments} deployment(s) may be stale. Pass --execute to enqueue interoperable envelopes.");

            return self::SUCCESS;
        }

        GenerationRun::where('status', 'queued')->each(fn (GenerationRun $run) => $transport->generation($run->id, $run->attempt ?? 1));
        Deployment::where('status', 'queued')->each(fn (Deployment $deployment) => $transport->deployment($deployment->id, $deployment->attempt ?? 1));

        // Preserve old payloads for inspection; Node must never deserialize them.
        $redis = Redis::connection(config('job_transport.redis_connection'));
        $legacy = 'queues:default';
        if ($redis->exists($legacy) && ! $redis->exists(config('job_transport.prefix').':legacy:queues:default:stale')) {
            $redis->rename($legacy, config('job_transport.prefix').':legacy:queues:default:stale');
        }
        $this->info("Migrated {$generations} generation(s) and {$deployments} deployment(s); legacy payloads were marked stale.");

        return self::SUCCESS;
    }
}
