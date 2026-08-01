<?php

namespace Tests\Feature;

use App\Models\Project;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RecoverStuckGenerationsTest extends TestCase
{
    use RefreshDatabase;

    private function project(): Project
    {
        return Project::create(['name' => 'Acme', 'slug' => 'acme', 'status' => 'generating', 'business_profile' => []]);
    }

    public function test_stale_cancelling_generation_becomes_cancelled_with_event(): void
    {
        config(['app.job_stale_after_seconds' => 120]);
        $run = $this->project()->generationRuns()->create([
            'provider' => 'mock', 'status' => 'cancelling', 'progress' => 42, 'input' => [],
            'heartbeat_at' => now()->subMinutes(3), 'cancellation_requested_at' => now()->subMinute(),
        ]);

        $this->artisan('generations:recover-stuck --execute')->assertSuccessful();

        $this->assertDatabaseHas('generation_runs', ['id' => $run->id, 'status' => 'cancelled']);
        $this->assertDatabaseHas('generation_events', [
            'generation_run_id' => $run->id,
            'event_type' => 'job.cancelled',
            'message' => 'Cancellation completed because the worker heartbeat expired.',
        ]);
    }

    public function test_healthy_active_generations_are_not_recovered(): void
    {
        config(['app.job_stale_after_seconds' => 120]);
        $project = $this->project();
        $running = $project->generationRuns()->create(['provider' => 'mock', 'status' => 'running', 'input' => [], 'heartbeat_at' => now()]);
        $queued = $project->generationRuns()->create(['provider' => 'mock', 'status' => 'queued', 'input' => [], 'queued_at' => now()]);

        $this->artisan('generations:recover-stuck --execute')->expectsOutput('Recovered 0 stuck generation(s).')->assertSuccessful();

        $this->assertSame('running', $running->fresh()->status);
        $this->assertSame('queued', $queued->fresh()->status);
        $this->assertDatabaseCount('generation_events', 0);
    }

    public function test_dry_run_detects_old_queued_generation_without_changing_it(): void
    {
        $run = $this->project()->generationRuns()->create(['provider' => 'mock', 'status' => 'queued', 'input' => [], 'queued_at' => now()->subMinutes(3)]);

        $this->artisan('generations:recover-stuck --dry-run')->expectsOutputToContain('1 stuck generation(s) found')->assertSuccessful();

        $this->assertSame('queued', $run->fresh()->status);
    }
}
