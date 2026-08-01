<?php

namespace App\Console\Commands;

use App\Models\Deployment;
use App\Models\GenerationRun;
use App\Services\JobTransport;
use Illuminate\Console\Command;

class RepublishOrphanedJobs extends Command
{
    protected $signature = 'jobs:republish-orphaned {--dry-run : Report without publishing} {--execute : Publish orphaned jobs}';

    protected $description = 'Republish queued records that have no worker pickup';

    public function handle(JobTransport $transport): int
    {
        if ($this->option('dry-run') && $this->option('execute')) {
            $this->error('Choose either --dry-run or --execute.');

            return self::INVALID;
        }

        $generations = GenerationRun::where('status', 'queued')->whereNull('started_at')->get();
        $deployments = Deployment::where('status', 'queued')->whereNull('started_at')->get();
        $count = $generations->count() + $deployments->count();
        if (! $this->option('execute')) {
            $this->info("Dry run: {$count} orphaned queued job(s); no jobs published.");

            return self::SUCCESS;
        }

        foreach ($generations as $run) {
            $transport->generation($run->id, $run->attempt ?? 1);
            $run->events()->create(['stage' => 'system', 'event_type' => 'run.republished', 'progress' => $run->progress, 'message' => 'Queued generation republished by recovery.']);
        }
        foreach ($deployments as $deployment) {
            $transport->deployment($deployment->id, $deployment->attempt ?? 1);
            $deployment->events()->create(['stage' => 'system', 'event_type' => 'deployment.republished', 'progress' => $deployment->progress, 'message' => 'Queued deployment republished by recovery.', 'created_at' => now()]);
        }
        $this->info("Republished {$count} orphaned queued job(s).");

        return self::SUCCESS;
    }
}
