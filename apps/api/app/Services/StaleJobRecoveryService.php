<?php

namespace App\Services;

use App\Models\Deployment;
use App\Models\GenerationRun;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use App\Models\DeploymentSnapshotUpload;

class StaleJobRecoveryService
{
    public function __construct(private readonly JobTransport $jobs) {}

    public function countGenerations(): int
    {
        return $this->stuckQuery(GenerationRun::query())->count();
    }

    public function countAll(): int
    {
        return $this->countGenerations() + $this->stuckQuery(Deployment::query())->count();
    }

    public function recoverGenerations(): int
    {
        return $this->recover(GenerationRun::class, 'generation');
    }

    public function recoverAll(): int
    {
        return $this->recoverGenerations() + $this->recover(Deployment::class, 'deployment');
    }

    private function stuckQuery(Builder $query): Builder
    {
        $cutoff = now()->subSeconds(config('app.job_stale_after_seconds'));

        return $query->whereIn('status', ['queued', 'claimed', 'running', 'cancelling'])
            ->whereNull('completed_at')
            ->where(function (Builder $query) use ($cutoff) {
                $query->where(function (Builder $queued) use ($cutoff) {
                    $queued->where('status', 'queued')
                        ->whereRaw('COALESCE(heartbeat_at, queued_at, created_at) < ?', [$cutoff]);
                })->orWhere(function (Builder $active) use ($cutoff) {
                    $active->whereIn('status', ['claimed', 'running', 'cancelling'])
                        ->where(fn (Builder $lease) => $lease->where('lease_expires_at', '<', now())->orWhereNull('lease_expires_at'))
                        ->whereRaw('COALESCE(heartbeat_at, started_at, queued_at, created_at) < ?', [$cutoff]);
                });
            });
    }

    /** @param class-string<GenerationRun|Deployment> $model */
    private function recover(string $model, string $type): int
    {
        $count = 0;
        $this->stuckQuery($model::query())->pluck('id')->each(function ($id) use ($model, $type, &$count) {
            DB::transaction(function () use ($id, $model, $type, &$count) {
                $record = $model::lockForUpdate()->find($id);
                if (! $record || $record->completed_at || ! in_array($record->status, ['queued', 'claimed', 'running', 'cancelling'], true)) {
                    return;
                }
                if ($record->status !== 'queued' && (($record->lease_expires_at && $record->lease_expires_at->isFuture()) || ($record->lease_expires_at && $record->heartbeat_at && $record->heartbeat_at->gt($record->lease_expires_at)))) {
                    return;
                }
                $cutoff = now()->subSeconds(config('app.job_stale_after_seconds'));
                if ($record->heartbeat_at && $record->heartbeat_at->gte($cutoff)) {
                    return;
                }
                if ($record instanceof Deployment) {
                    $recentUpload = DeploymentSnapshotUpload::where('deployment_id', $record->id)
                        ->where(fn (Builder $query) => $query->where('updated_at', '>=', $cutoff)->orWhere(fn (Builder $created) => $created->whereNull('updated_at')->where('created_at', '>=', $cutoff)))
                        ->exists();
                    $terminal = $record->events()->whereIn('event_type', ['deployment.completed', 'deployment.failed', 'deployment.cancelled', 'stage.failed'])->where(fn (Builder $query) => $query->whereIn('event_type', ['deployment.completed', 'deployment.failed', 'deployment.cancelled'])->orWhere('metadata->terminal', true))->exists();
                    if ($recentUpload || $terminal) {
                        return;
                    }
                }
                if (str_starts_with((string) data_get($record->error, 'classification'), 'non_retryable')) {
                    return;
                }
                $count++;
                if ($record->status === 'cancelling') {
                    $record->update(['status' => 'cancelled', 'worker_id' => null, 'current_stage' => null, 'completed_at' => now(), ...($record instanceof Deployment ? ['cancelled_at' => now()] : [])]);
                    $record->events()->create([
                        'stage' => 'system',
                        'event_type' => 'job.cancelled',
                        'progress' => $record->progress,
                        'message' => 'Cancellation completed because the worker heartbeat expired.',
                        'created_at' => now(),
                    ]);

                    return;
                }

                $previousStatus = $record->status;
                $record->increment('recovery_count');
                $record->update(['status' => 'queued', 'worker_id' => null, 'claimed_by_worker_id' => null, 'lease_token' => null, 'lease_expires_at' => null, 'queued_at' => now(), 'heartbeat_at' => null]);
                $key = md5("{$type}:{$record->id}:recovery:{$record->recovery_count}");
                $uuid = substr($key, 0, 8).'-'.substr($key, 8, 4).'-5'.substr($key, 13, 3).'-a'.substr($key, 17, 3).'-'.substr($key, 20, 12);
                $record->events()->firstOrCreate(['event_uuid' => $uuid], [
                    'stage' => 'system', 'event_type' => 'job.recovered', 'progress' => $record->progress,
                    'message' => $previousStatus === 'queued' ? 'Queued job was republished.' : 'Expired worker lease was recovered.', 'created_at' => now(),
                ]);
                // Recovery redelivers the same execution attempt; it never consumes a user attempt.
                $this->jobs->{$type}($record->id, $record->attempt ?? 1);
            });
        });

        return $count;
    }
}
