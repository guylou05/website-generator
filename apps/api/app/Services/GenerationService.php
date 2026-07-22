<?php

namespace App\Services;

use App\Models\GenerationRun;
use Illuminate\Support\Facades\DB;
use Throwable;

class GenerationService
{
    private const STAGES = ['analysis', 'planning', 'seo', 'writing', 'design', 'blueprint', 'validation', 'elementor'];

    public function execute(GenerationRun $run): GenerationRun
    {
        $run->update(['status' => 'running', 'started_at' => now()]);
        $run->project()->update(['status' => 'generating']);

        try {
            if ($run->provider !== 'mock') {
                throw new \RuntimeException('The configured provider is unavailable.');
            }
            foreach (self::STAGES as $index => $stage) {
                $progress = (int) round((($index + 1) / count(self::STAGES)) * 100);
                DB::transaction(function () use ($run, $stage, $progress) {
                    $run->events()->create(['stage' => $stage, 'event_type' => 'stage.completed', 'progress' => $progress, 'message' => ucfirst($stage).' completed']);
                    $run->update(['current_stage' => $stage, 'progress' => $progress]);
                });
            }
            $pages = ['home', 'about', 'services', 'contact'];
            $output = ['blueprint' => ['schemaVersion' => '1.0', 'valid' => true, 'pages' => array_map(fn ($id) => ['id' => $id], $pages)], 'elementor' => ['status' => 'ready', 'documents' => array_map(fn ($id) => ['page' => $id, 'elements' => []], $pages)], 'summary' => ['pages_generated' => count($pages), 'blueprint_valid' => true, 'elementor_ready' => true]];
            $run->update(['status' => 'completed', 'current_stage' => null, 'progress' => 100, 'output' => $output, 'error' => null, 'completed_at' => now()]);
            $run->project()->update(['status' => 'ready']);
        } catch (Throwable $exception) {
            $safeError = ['code' => 'generation_failed', 'message' => 'Website generation failed. Please retry.'];
            $run->events()->create(['stage' => $run->current_stage ?? 'initialization', 'event_type' => 'run.failed', 'progress' => $run->progress, 'message' => $safeError['message']]);
            $run->update(['status' => 'failed', 'error' => $safeError, 'completed_at' => now()]);
            $run->project()->update(['status' => 'failed']);
        }

        return $run->fresh('events');
    }
}
