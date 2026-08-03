<?php

namespace App\Console\Commands;

use App\Models\GenerationRun;
use App\Services\WebsiteRevisionService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class RepairGenerationFinalization extends Command
{
    protected $signature = 'generations:repair-finalization {--run= : Generation run UUID}';

    protected $description = 'Reconcile a failed generation only when its persisted artifacts are complete and valid';

    public function handle(WebsiteRevisionService $revisions): int
    {
        $run = GenerationRun::withoutGlobalScopes()->findOrFail($this->option('run'));
        $revision = $run->project->websiteRevisions()->where('generation_run_id', $run->id)->first();
        if (! $revision || $revision->project_id !== $run->project_id || ! $revisions->validate($revision)['valid']) {
            $this->error('Repair refused: revision ownership or blueprint validation failed.');

            return self::FAILURE;
        }
        $pages = collect($revision->blueprint['pages'] ?? [])->pluck('id')->sort()->values();
        $renders = collect($revision->elementor_output['documents'] ?? [])->pluck('page')->unique()->sort()->values();
        if ($pages->isEmpty() || $pages->all() !== $renders->all()) {
            $this->error('Repair refused: generated page artifacts are incomplete.');

            return self::FAILURE;
        }

        DB::transaction(function () use ($run, $revision) {
            $locked = GenerationRun::withoutGlobalScopes()->lockForUpdate()->findOrFail($run->id);
            abort_unless(in_array($locked->status, ['failed', 'succeeded'], true), 409, 'Only a terminal generation may be reconciled.');
            $locked->events()->firstOrCreate(['event_uuid' => $this->uuid("generation:{$locked->id}:repair")], ['stage' => 'completion', 'event_type' => 'generation.finalization_repaired', 'progress' => 100, 'message' => 'Persisted generation artifacts were verified and finalization was reconciled.', 'metadata' => ['previous_status' => $locked->status, 'revision_id' => $revision->id], 'created_at' => now()]);
            $locked->update(['status' => 'succeeded', 'progress' => 100, 'completed_at' => $locked->completed_at ?: now(), 'error' => null, 'lease_token' => null, 'lease_expires_at' => null]);
            $revision->update(['status' => 'ready']);
            $locked->project()->update(['latest_revision_id' => $revision->id, 'status' => 'ready']);
        });
        $this->info("Generation {$run->id} safely reconciled; audit events were preserved.");

        return self::SUCCESS;
    }

    private function uuid(string $value): string
    {
        $hex = md5($value);

        return substr($hex, 0, 8).'-'.substr($hex, 8, 4).'-5'.substr($hex, 13, 3).'-a'.substr($hex, 17, 3).'-'.substr($hex, 20, 12);
    }
}
