<?php

namespace Tests\Feature;

use App\Models\Project;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProjectGenerationTest extends TestCase
{
    use RefreshDatabase;

    private function project(): Project
    {
        return Project::create(['name' => 'Acme', 'slug' => 'acme', 'status' => 'draft', 'business_profile' => ['businessName' => 'Acme']]);
    }

    public function test_project_crud(): void
    {
        $created = $this->postJson('/api/projects', ['name' => 'Acme', 'business_profile' => ['industry' => 'Tech']])->assertCreated()->json('data');
        $this->getJson('/api/projects')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/projects/'.$created['id'])->assertOk()->assertJsonPath('data.name', 'Acme');
        $this->patchJson('/api/projects/'.$created['id'], ['name' => 'Acme Two'])->assertOk()->assertJsonPath('data.name', 'Acme Two');
        $this->deleteJson('/api/projects/'.$created['id'])->assertNoContent();
    }

    public function test_generation_persists_events_and_successful_outputs(): void
    {
        $response = $this->postJson('/api/projects/'.$this->project()->id.'/generations', ['input' => ['businessName' => 'Acme', 'services' => ['Consulting']]])->assertCreated();
        $response->assertJsonPath('data.status', 'completed')->assertJsonPath('data.progress', 100)->assertJsonPath('data.output.summary.pages_generated', 4)->assertJsonPath('data.output.summary.blueprint_valid', true)->assertJsonPath('data.output.summary.elementor_ready', true);
        $this->assertDatabaseCount('generation_events', 8);
    }

    public function test_failure_is_safe_and_persisted(): void
    {
        $response = $this->postJson('/api/projects/'.$this->project()->id.'/generations', ['provider' => 'openai', 'input' => ['businessName' => 'Acme']])->assertCreated();
        $response->assertJsonPath('data.status', 'failed')->assertJsonPath('data.error.code', 'generation_failed')->assertJsonMissing(['OPENAI_API_KEY']);
        $this->assertDatabaseHas('generation_runs', ['status' => 'failed']);
    }

    public function test_failed_generation_can_be_retried(): void
    {
        $project = $this->project();
        $run = $project->generationRuns()->create(['provider' => 'mock', 'status' => 'failed', 'progress' => 10, 'input' => ['businessName' => 'Acme'], 'error' => ['code' => 'failed']]);
        $this->postJson('/api/generations/'.$run->id.'/retry')->assertOk()->assertJsonPath('data.status', 'completed');
        $this->assertDatabaseCount('generation_runs', 2);
    }

    public function test_pending_generation_can_be_cancelled(): void
    {
        $project = $this->project();
        $run = $project->generationRuns()->create(['provider' => 'mock', 'status' => 'pending', 'progress' => 0, 'input' => ['businessName' => 'Acme']]);
        $this->postJson('/api/generations/'.$run->id.'/cancel')->assertOk()->assertJsonPath('data.status', 'cancelled');
        $this->assertDatabaseHas('generation_events', ['generation_run_id' => $run->id, 'event_type' => 'run.cancelled']);
    }
}
