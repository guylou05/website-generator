<?php

namespace App\Services;

use App\Models\Deployment;
use App\Models\GenerationRun;
use Illuminate\Database\Eloquent\Builder;

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

        return $query->whereIn('status', ['queued', 'running', 'cancelling'])
            ->where(function (Builder $query) use ($cutoff) {
                $query->where(function (Builder $queued) use ($cutoff) {
                    $queued->where('status', 'queued')
                        ->whereRaw('COALESCE(heartbeat_at, queued_at, created_at) < ?', [$cutoff]);
                })->orWhere(function (Builder $active) use ($cutoff) {
                    $active->whereIn('status', ['running', 'cancelling'])
                        ->whereRaw('COALESCE(heartbeat_at, started_at, queued_at, created_at) < ?', [$cutoff]);
                });
            });
    }

    /** @param class-string<GenerationRun|Deployment> $model */
    private function recover(string $model, string $type): int
    {
        $count = 0;
        $this->stuckQuery($model::query())->eachById(function ($record) use ($type, &$count) {
            $count++;
            if ($record->status === 'cancelling') {
                $record->update(['status' => 'cancelled', 'worker_id' => null, 'current_stage' => null, 'completed_at' => now()]);
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
            $record->update(['status' => 'stale', 'worker_id' => null]);
            $record->events()->create([
                'stage' => 'system',
                'event_type' => 'job.stale',
                'progress' => $record->progress,
                'message' => $previousStatus === 'queued'
                    ? 'The queued job was not picked up before the recovery timeout.'
                    : 'Worker heartbeat expired; recovery started.',
                'created_at' => now(),
            ]);
            if ($record->attempt < $record->max_attempts) {
                $record->update(['status' => 'queued', 'attempt' => $record->attempt + 1, 'queued_at' => now(), 'heartbeat_at' => null]);
                $this->jobs->{$type}($record->id, $record->attempt ?? 1);
            } else {
                $record->update(['status' => 'failed', 'error' => ['code' => 'retry_exhausted', 'message' => 'The job could not be recovered.'], 'completed_at' => now()]);
            }
        });

        return $count;
    }
}
