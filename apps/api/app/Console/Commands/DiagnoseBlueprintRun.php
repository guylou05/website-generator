<?php

namespace App\Console\Commands;

use App\Models\GenerationRun;
use Illuminate\Console\Command;

class DiagnoseBlueprintRun extends Command
{
    protected $signature = 'blueprints:diagnose-run {generationRunId}';

    protected $description = 'Show safe blueprint validation diagnostics for a generation run';

    public function handle(): int
    {
        $run = GenerationRun::withoutGlobalScopes()->findOrFail($this->argument('generationRunId'));
        $details = $run->error['details'] ?? [];
        $events = $run->events()->get();
        $this->table(['Field', 'Value'], [
            ['Provider', $run->provider],
            ['Model', $run->input['model'] ?? 'not recorded'],
            ['Schema version', $details['schema_version'] ?? '1.0'],
            ['Validation status', ($run->error['code'] ?? null) === 'blueprint_validation_failed' ? 'failed' : ($run->status === 'succeeded' ? 'valid' : 'unknown')],
            ['Normalization applied', $events->contains(fn ($event) => (bool) ($event->metadata['normalization_applied'] ?? false)) ? 'yes' : 'no'],
            ['Repair attempted', $events->contains(fn ($event) => str_contains($event->event_type, 'repair')) ? 'yes' : 'no'],
            ['Output hash', $details['output_hash'] ?? 'not recorded'],
        ]);
        foreach ($details['issues'] ?? [] as $issue) {
            $this->line(($issue['path'] ?? '<root>').': '.($issue['message'] ?? 'Invalid value'));
        }

        return self::SUCCESS;
    }
}
