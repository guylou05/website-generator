<?php

namespace Tests\Feature;

use App\Jobs\GenerateWebsite;
use App\Models\Project;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
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

    public function test_generation_is_persisted_and_dispatched_without_execution(): void
    {
        Queue::fake();
        $response = $this->postJson('/api/projects/'.$this->project()->id.'/generations', ['input' => ['businessName' => 'Acme']])->assertStatus(202);
        $response->assertJsonPath('data.status', 'queued')->assertJsonPath('data.progress', 0)->assertJsonPath('data.output', null);
        Queue::assertPushed(GenerateWebsite::class, fn ($job) => $job->generationRunId === $response->json('data.id'));
        $this->assertDatabaseCount('generation_events', 1);
    }

    public function test_failed_generation_can_be_retried(): void
    {
        $project = $this->project();
        $run = $project->generationRuns()->create(['provider' => 'mock', 'status' => 'failed', 'progress' => 10, 'input' => ['businessName' => 'Acme'], 'error' => ['code' => 'failed']]);
        Queue::fake();
        $this->postJson('/api/generations/'.$run->id.'/retry')->assertStatus(202)->assertJsonPath('data.status', 'queued');
        $this->assertDatabaseCount('generation_runs', 2);
    }

    public function test_pending_generation_can_be_cancelled(): void
    {
        $project = $this->project();
        $run = $project->generationRuns()->create(['provider' => 'mock', 'status' => 'queued', 'progress' => 0, 'input' => ['businessName' => 'Acme']]);
        $this->postJson('/api/generations/'.$run->id.'/cancel')->assertOk()->assertJsonPath('data.status', 'cancelling');
        $this->assertDatabaseHas('generation_events', ['generation_run_id' => $run->id, 'event_type' => 'run.cancelling']);
    }
}
