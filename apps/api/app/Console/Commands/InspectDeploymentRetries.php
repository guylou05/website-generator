<?php

namespace App\Console\Commands;

use App\Models\Deployment;
use Illuminate\Console\Command;

class InspectDeploymentRetries extends Command
{
    protected $signature = 'deployments:inspect-retries {--deployment= : Deployment UUID}';

    protected $description = 'Safely inspect deployment attempt, delivery, recovery, retry, and write history';

    public function handle(): int
    {
        $source = Deployment::withoutGlobalScopes()->findOrFail($this->option('deployment'));
        $root = $source->parent_deployment_id ?: $source->id;
        $attempts = Deployment::withoutGlobalScopes()->with('events')->where(fn ($q) => $q->whereKey($root)->orWhere('parent_deployment_id', $root))->orderBy('attempt_number')->get();
        $this->table(['ID', 'Attempt', 'Deliveries', 'Recoveries', 'Transient retries', 'Status', 'Terminal error', 'Duplicate events', 'WP writes'], $attempts->map(function ($attempt) {
            $duplicates = $attempt->events->groupBy(fn ($event) => $event->event_uuid ?: "{$event->event_type}:{$event->stage}")->filter(fn ($events) => $events->count() > 1)->count();
            $writes = $attempt->items()->exists() || $attempt->rollback_snapshot_id || collect($attempt->operations)->contains(fn ($op) => in_array(data_get($op, 'action'), ['create', 'update', 'upload', 'configure'], true));

            return [$attempt->id, $attempt->attempt_number, $attempt->queue_delivery_count, $attempt->recovery_count, $attempt->transient_retry_count, $attempt->status, data_get($attempt->error, 'underlying.code', data_get($attempt->error, 'code', '-')), $duplicates, $writes ? 'yes' : 'no'];
        }));

        return self::SUCCESS;
    }
}
