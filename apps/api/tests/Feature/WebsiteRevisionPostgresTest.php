<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\User;
use App\Services\WebsiteRevisionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class WebsiteRevisionPostgresTest extends TestCase
{
    use RefreshDatabase;

    public function test_creating_a_revision_locks_a_row_instead_of_an_aggregate(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            $this->markTestSkipped('This regression test requires PostgreSQL.');
        }

        $user = User::where('email', 'legacy-owner@localhost.invalid')->firstOrFail();
        $project = Project::create([
            'organization_id' => $user->current_organization_id,
            'name' => 'PostgreSQL revision test',
            'slug' => 'postgresql-revision-test',
            'status' => 'draft',
            'business_profile' => [],
        ]);
        $service = app(WebsiteRevisionService::class);

        $first = $service->create($project, []);
        $second = $service->create($project, [], parent: $first);

        $this->assertSame(1, $first->revision_number);
        $this->assertSame(2, $second->revision_number);
        $this->assertDatabaseHas('website_revisions', [
            'project_id' => $project->id,
            'revision_number' => 2,
        ]);
    }
}
