<?php

namespace Tests\Feature;

use App\Models\Project;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InternalWorkerTest extends TestCase
{
    use RefreshDatabase;

    public function test_internal_context_requires_worker_token(): void
    {
        config(['app.internal_worker_token' => 'test-worker-token']);
        $project = Project::create(['name' => 'Acme', 'slug' => 'acme', 'status' => 'draft', 'business_profile' => ['businessName' => 'Acme']]);
        $run = $project->generationRuns()->create(['provider' => 'mock', 'status' => 'queued', 'progress' => 0, 'input' => ['businessName' => 'Acme']]);
        $url = '/api/internal/generations/'.$run->id.'/execution-context';
        $this->getJson($url)->assertUnauthorized();
        $this->withToken('test-worker-token')->getJson($url)->assertOk()->assertJsonMissing(['OPENAI_API_KEY']);
    }
}
