<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\User;
use App\Models\WebsiteRevision;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProjectGenerationSummaryTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_bootstrap_and_project_list_contract_are_unchanged(): void
    {
        $user = User::where('email', 'legacy-owner@localhost.invalid')->firstOrFail();
        $project = $this->project($user, 'List project');

        $this->getJson('/api/auth/user')->assertOk()->assertJsonPath('data.id', $user->id);
        $response = $this->getJson('/api/projects')->assertOk()->assertJsonCount(1, 'data');
        $this->assertSame([
            'id', 'name', 'slug', 'status', 'business_profile', 'brand_settings',
            'created_at', 'updated_at', 'generation_runs',
        ], array_keys($response->json('data.0')));
        $response->assertJsonPath('data.0.id', $project->id)->assertJsonMissingPath('data.0.summary');
    }

    public function test_project_without_revision_loads_with_safe_summary_defaults(): void
    {
        $user = User::where('email', 'legacy-owner@localhost.invalid')->firstOrFail();
        $project = $this->project($user, 'Draft project');

        $this->getJson('/api/projects/'.$project->id)->assertOk()->assertJsonPath('data.id', $project->id);
        $this->getJson('/api/projects/'.$project->id.'/generation-summary')->assertOk()->assertExactJson([
            'data' => [
                'generation_status' => 'not_generated',
                'latest_revision' => null,
                'page_count' => 0,
                'blueprint_status' => 'not_generated',
                'elementor_status' => 'not_ready',
                'deployment_ready' => false,
            ],
        ]);
    }

    public function test_completed_revision_summary_is_bounded_and_deployment_ready(): void
    {
        $user = User::where('email', 'legacy-owner@localhost.invalid')->firstOrFail();
        $project = $this->project($user, 'Generated project');
        $run = $project->generationRuns()->create(['provider' => 'mock', 'status' => 'succeeded', 'progress' => 100, 'input' => []]);
        $revision = WebsiteRevision::create([
            'organization_id' => $project->organization_id,
            'project_id' => $project->id,
            'generation_run_id' => $run->id,
            'revision_number' => 1,
            'status' => 'ready',
            'source' => 'generation',
            'blueprint' => ['pages' => [['id' => 'home'], ['id' => 'about']]],
            'validation' => ['valid' => true],
            'elementor_output' => [
                'status' => 'ready',
                'documents' => [['page' => 'home'], ['page' => 'about']],
            ],
        ]);
        $project->update(['latest_revision_id' => $revision->id]);

        $response = $this->getJson('/api/projects/'.$project->id.'/generation-summary')->assertOk()
            ->assertJsonPath('data.generation_status', 'succeeded')
            ->assertJsonPath('data.latest_revision.id', $revision->id)
            ->assertJsonPath('data.page_count', 2)
            ->assertJsonPath('data.blueprint_status', 'valid')
            ->assertJsonPath('data.elementor_status', 'ready')
            ->assertJsonPath('data.deployment_ready', true);

        $this->assertSame([
            'generation_status', 'latest_revision', 'page_count', 'blueprint_status',
            'elementor_status', 'deployment_ready',
        ], array_keys($response->json('data')));
        $response->assertJsonMissingPath('data.latest_revision.project')
            ->assertJsonMissingPath('data.latest_revision.blueprint')
            ->assertJsonMissingPath('data.latest_revision.pages');
    }

    private function project(User $user, string $name): Project
    {
        return Project::create([
            'organization_id' => $user->current_organization_id,
            'name' => $name,
            'slug' => str($name)->slug().'-'.str()->random(5),
            'status' => 'draft',
            'business_profile' => [],
        ]);
    }
}
