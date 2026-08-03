<?php

namespace Tests\Feature;

use App\Models\Project;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InternalWorkerTest extends TestCase
{
    use RefreshDatabase;

    public function test_worker_claim_and_heartbeat_require_and_renew_a_lease(): void
    {
        config(['app.internal_worker_token' => 'test-worker-token', 'app.job_lease_seconds' => 90]);
        $project = Project::create(['name' => 'Lease', 'slug' => 'lease', 'status' => 'generating', 'business_profile' => []]);
        $run = $project->generationRuns()->create(['provider' => 'mock', 'status' => 'queued', 'progress' => 0, 'input' => []]);
        $claim = $this->withToken('test-worker-token')->postJson('/api/internal/generations/'.$run->id.'/started', ['worker_id' => 'worker-a'])->assertOk()->assertJsonPath('data.claimed', true);
        $token = $claim->json('data.lease_token');
        $this->assertSame(64, strlen($token));
        $expiry = $run->fresh()->lease_expires_at;
        $this->travel(10)->seconds();
        $this->withToken('test-worker-token')->postJson('/api/internal/generations/'.$run->id.'/heartbeat', ['lease_token' => $token])->assertOk();
        $this->assertTrue($run->fresh()->lease_expires_at->gt($expiry));
        $this->withToken('test-worker-token')->postJson('/api/internal/generations/'.$run->id.'/heartbeat', ['lease_token' => str_repeat('0', 64)])->assertConflict()->assertJsonPath('error.code', 'generation_state_conflict');
    }

    public function test_internal_context_requires_worker_token(): void
    {
        config(['app.internal_worker_token' => 'test-worker-token']);
        $project = Project::create(['name' => 'Acme', 'slug' => 'acme', 'status' => 'draft', 'business_profile' => ['businessName' => 'Acme']]);
        $run = $project->generationRuns()->create(['provider' => 'mock', 'status' => 'queued', 'progress' => 0, 'input' => ['businessName' => 'Acme']]);
        $url = '/api/internal/generations/'.$run->id.'/execution-context';
        $this->getJson($url)->assertUnauthorized();
        $this->withToken('test-worker-token')->getJson($url)->assertOk()->assertJsonMissing(['OPENAI_API_KEY']);
    }

    public function test_successful_completion_atomically_persists_revision_and_project_summary(): void
    {
        config(['app.internal_worker_token' => 'test-worker-token']);
        $project = Project::create(['name' => 'Acme', 'slug' => 'acme', 'status' => 'generating', 'business_profile' => ['businessName' => 'Acme']]);
        $run = $project->generationRuns()->create(['provider' => 'mock', 'status' => 'running', 'progress' => 95, 'input' => []]);
        $run->update(['lease_token' => str_repeat('a', 64), 'claimed_by_worker_id' => 'test-worker', 'lease_expires_at' => now()->addMinute()]);
        $blueprint = json_decode(file_get_contents(base_path('../../packages/shared/sample-blueprint.json')), true, flags: JSON_THROW_ON_ERROR);
        $documents = collect($blueprint['pages'])->map(fn (array $page) => ['page' => $page['id'], 'elements' => [['id' => $page['id']]]])->all();

        $payload = [
            'lease_token' => str_repeat('a', 64), 'completion_idempotency_key' => 'generation:'.$run->id.':attempt:1',
            'output' => ['blueprint' => $blueprint, 'elementor' => ['status' => 'ready', 'documents' => $documents]],
        ];
        $payload['completion_checksum'] = hash('sha256', json_encode($payload['output'], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR));
        $this->withToken('test-worker-token')->postJson('/api/internal/generations/'.$run->id.'/completed', $payload)->assertOk()->assertJsonPath('data.status', 'succeeded');
        $this->withToken('test-worker-token')->postJson('/api/internal/generations/'.$run->id.'/completed', $payload)->assertOk()->assertJsonPath('data.status', 'succeeded');
        $this->assertSame(1, $project->websiteRevisions()->count());
        $this->withToken('test-worker-token')->postJson('/api/internal/generations/'.$run->id.'/completed', [...$payload, 'completion_idempotency_key' => 'different-attempt'])->assertConflict()->assertJsonPath('error.code', 'generation_state_conflict');

        $revision = $project->websiteRevisions()->sole();
        $this->assertTrue($revision->validation['valid']);
        $this->assertSame('ready', $revision->status);
        $this->assertSame('ready', $revision->elementor_output['status']);
        $this->assertCount(count($blueprint['pages']), $revision->elementor_output['documents']);
        $this->assertDatabaseHas('projects', ['id' => $project->id, 'status' => 'ready', 'latest_revision_id' => $revision->id]);
        $this->assertSame(count($blueprint['pages']), $run->fresh()->output['summary']['pages_generated']);

        $this->getJson('/api/projects/'.$project->id.'/generation-summary')
            ->assertOk()
            ->assertJsonPath('data.generation_status', 'succeeded')
            ->assertJsonPath('data.page_count', count($blueprint['pages']))
            ->assertJsonPath('data.blueprint_status', 'valid')
            ->assertJsonPath('data.elementor_status', 'ready')
            ->assertJsonPath('data.deployment_ready', true);
    }

    public function test_incomplete_render_persistence_fails_the_run_without_marking_project_ready(): void
    {
        config(['app.internal_worker_token' => 'test-worker-token']);
        $project = Project::create(['name' => 'Acme', 'slug' => 'acme', 'status' => 'generating', 'business_profile' => []]);
        $run = $project->generationRuns()->create(['provider' => 'mock', 'status' => 'running', 'progress' => 95, 'input' => []]);
        $run->update(['lease_token' => str_repeat('a', 64), 'claimed_by_worker_id' => 'test-worker', 'lease_expires_at' => now()->addMinute()]);
        $blueprint = json_decode(file_get_contents(base_path('../../packages/shared/sample-blueprint.json')), true, flags: JSON_THROW_ON_ERROR);

        $this->withToken('test-worker-token')->postJson('/api/internal/generations/'.$run->id.'/completed', [
            'lease_token' => str_repeat('a', 64), 'completion_idempotency_key' => 'generation:'.$run->id.':attempt:1', 'completion_checksum' => hash('sha256', json_encode(['blueprint' => $blueprint, 'elementor' => ['status' => 'ready', 'documents' => [['page' => $blueprint['pages'][0]['id'], 'elements' => []]]]], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)),
            'output' => ['blueprint' => $blueprint, 'elementor' => ['status' => 'ready', 'documents' => [['page' => $blueprint['pages'][0]['id'], 'elements' => []]]]],
        ])->assertUnprocessable();

        $this->assertDatabaseHas('generation_runs', ['id' => $run->id, 'status' => 'failed']);
        $this->assertDatabaseHas('projects', ['id' => $project->id, 'status' => 'generating', 'latest_revision_id' => null]);
        $this->assertDatabaseMissing('website_revisions', ['generation_run_id' => $run->id]);
    }
}
