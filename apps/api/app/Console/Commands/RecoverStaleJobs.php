<?php

namespace App\Console\Commands;

use App\Models\Deployment;
use App\Models\GenerationRun;
use App\Services\JobTransport;
use Illuminate\Console\Command;

class RecoverStaleJobs extends Command
{
    protected $signature = 'jobs:recover-stale {--dry-run : Report stale jobs without changing them} {--execute : Recover stale jobs}';

    protected $description = 'Recover jobs whose worker heartbeat expired';

    public function handle(): int
    {
        $cutoff = now()->subSeconds(config('app.job_stale_after_seconds'));
        $count = GenerationRun::where('status', 'running')->where(fn ($q) => $q->whereNull('heartbeat_at')->orWhere('heartbeat_at', '<', $cutoff))->count()
            + Deployment::where('status', 'running')->where(fn ($q) => $q->whereNull('heartbeat_at')->orWhere('heartbeat_at', '<', $cutoff))->count();
        if (! $this->option('execute')) {
            $this->info("Dry run: {$count} stale job(s) found; no records changed. Pass --execute to recover them.");

            return self::SUCCESS;
        }
        $transport = app(JobTransport::class);
        foreach ([[GenerationRun::class, 'generation'], [Deployment::class, 'deployment']] as [$model, $method]) {
            $model::where('status', 'running')->where(fn ($q) => $q->whereNull('heartbeat_at')->orWhere('heartbeat_at', '<', $cutoff))->each(function ($record) use ($transport, $method) {
                $record->update(['status' => 'stale', 'worker_id' => null]);
                $record->events()->create(['stage' => 'system', 'event_type' => 'job.stale', 'progress' => $record->progress, 'message' => 'Worker heartbeat expired; recovery started.', 'created_at' => now()]);
                if ($record->attempt < $record->max_attempts) {
                    $record->update(['status' => 'queued', 'attempt' => $record->attempt + 1, 'queued_at' => now()]);
                    $transport->{$method}($record->id, $record->attempt);
                } else {
                    $record->update(['status' => 'failed', 'error' => ['code' => 'retry_exhausted', 'message' => 'The job could not be recovered.'], 'completed_at' => now()]);
                }
            });
        }

        return self::SUCCESS;
    }
}
