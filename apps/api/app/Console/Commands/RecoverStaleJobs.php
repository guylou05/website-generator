<?php

namespace App\Console\Commands;

use App\Jobs\DeployWebsite;
use App\Jobs\GenerateWebsite;
use App\Models\Deployment;
use App\Models\GenerationRun;
use Illuminate\Console\Command;

class RecoverStaleJobs extends Command
{
    protected $signature = 'jobs:recover-stale';

    protected $description = 'Recover jobs whose worker heartbeat expired';

    public function handle(): int
    {
        $cutoff = now()->subSeconds(config('app.job_stale_after_seconds'));
        foreach ([[GenerationRun::class, GenerateWebsite::class], [Deployment::class, DeployWebsite::class]] as [$model, $job]) {
            $model::where('status', 'running')->where(fn ($q) => $q->whereNull('heartbeat_at')->orWhere('heartbeat_at', '<', $cutoff))->each(function ($record) use ($job) {
                $record->update(['status' => 'stale', 'worker_id' => null]);
                $record->events()->create(['stage' => 'system', 'event_type' => 'job.stale', 'progress' => $record->progress, 'message' => 'Worker heartbeat expired; recovery started.', 'created_at' => now()]);
                if ($record->attempt < $record->max_attempts) {
                    $record->update(['status' => 'queued', 'attempt' => $record->attempt + 1, 'queued_at' => now()]);
                    $job::dispatch($record->id);
                } else {
                    $record->update(['status' => 'failed', 'error' => ['code' => 'retry_exhausted', 'message' => 'The job could not be recovered.'], 'completed_at' => now()]);
                }
            });
        }

        return self::SUCCESS;
    }
}
