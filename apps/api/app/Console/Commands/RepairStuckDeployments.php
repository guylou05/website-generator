<?php

namespace App\Console\Commands;

use App\Models\Deployment;
use Illuminate\Console\Command;

class RepairStuckDeployments extends Command
{
    protected $signature = 'deployments:repair-stuck {--deployment= : Limit repair to one deployment UUID}';

    protected $description = 'Audit duplicate attempt starts and terminally close non-retryable deployments without deleting events';

    public function handle(): int
    {
        $query = Deployment::with('events');
        if ($id = $this->option('deployment')) {
            $query->whereKey($id);
        }
        $repaired = 0;
        foreach ($query->get() as $deployment) {
            $starts = $deployment->events->where('event_type', 'deployment.started')->count();
            if ($starts > 1) {
                $this->warn("{$deployment->id}: {$starts} duplicate attempt-start events preserved");
            }
            $terminal = $deployment->events->first(fn ($event) => $event->event_type === 'stage.failed' && data_get($event->metadata, 'terminal') === true && str_starts_with((string) data_get($event->metadata, 'classification'), 'non_retryable'));
            if ($terminal && ! in_array($deployment->status, ['failed', 'cancelled', 'succeeded'], true)) {
                $deployment->update(['status' => 'failed', 'current_stage' => $terminal->stage, 'failed_at' => $terminal->created_at, 'completed_at' => $terminal->created_at, 'error' => ['code' => data_get($terminal->metadata, 'code', 'terminal_failure'), 'classification' => data_get($terminal->metadata, 'classification'), 'retryable' => false, 'message' => $terminal->message]]);
                $repaired++;
            }
        }
        $this->info("Repaired {$repaired} deployment(s); historical events were preserved.");

        return self::SUCCESS;
    }
}
