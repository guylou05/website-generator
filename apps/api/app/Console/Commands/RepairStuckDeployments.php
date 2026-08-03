<?php

namespace App\Console\Commands;

use App\Models\Deployment;
use App\Models\DeploymentSnapshotUpload;
use App\Services\JobTransport;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class RepairStuckDeployments extends Command
{
    protected $signature = 'deployments:repair-stuck {--deployment= : Limit repair to one deployment UUID}';

    protected $description = 'Safely clear an invalid expired lease and resume a stuck snapshot upload';

    public function handle(JobTransport $jobs): int
    {
        $id = $this->option('deployment');
        if (! $id) {
            $this->error('--deployment is required for a targeted, safe repair.');

            return self::FAILURE;
        }
        $repaired = 0;
        DB::transaction(function () use ($id, $jobs, &$repaired) {
            $deployment = Deployment::lockForUpdate()->findOrFail($id);
            $upload = DeploymentSnapshotUpload::where('deployment_id', $id)->withCount('chunks')->first();
            $terminal = $deployment->events()->whereIn('event_type', ['deployment.completed', 'deployment.failed', 'deployment.cancelled'])->exists();
            $this->line("lease=".($deployment->lease_expires_at?->toIso8601String() ?? 'none')." upload=".($upload?->id ?? 'none')." chunks=".($upload?->chunks_count ?? 0)." terminal=".($terminal ? 'yes' : 'no'));
            if ($terminal || ! in_array($deployment->status, ['claimed', 'running'], true) || ! $deployment->lease_expires_at?->isPast()) {
                return;
            }
            $deployment->update(['status' => 'queued', 'worker_id' => null, 'claimed_by_worker_id' => null, 'lease_token' => null, 'lease_expires_at' => null, 'queued_at' => now()]);
            $jobs->deployment($deployment->id, $deployment->attempt);
            $repaired = 1;
        });
        $this->info("Repaired {$repaired} deployment(s); historical events were preserved.");

        return self::SUCCESS;
    }
}
