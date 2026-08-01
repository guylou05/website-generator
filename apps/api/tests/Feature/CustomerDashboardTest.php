<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class CustomerDashboardTest extends TestCase
{
    use RefreshDatabase;

    public function test_overview_returns_real_empty_metrics_and_profile_context(): void
    {
        $user = User::where('email', 'legacy-owner@localhost.invalid')->firstOrFail();
        Project::where('organization_id', $user->current_organization_id)->delete();

        $this->getJson('/api/dashboard/overview')->assertOk()
            ->assertJsonPath('data.user.id', $user->id)
            ->assertJsonPath('data.metrics.total_projects', 0)
            ->assertJsonPath('data.metrics.live_websites', 0)
            ->assertJsonPath('data.metrics.average_generation_seconds', null)
            ->assertJsonCount(0, 'data.recent_projects');
    }

    public function test_overview_isolates_projects_to_current_organization(): void
    {
        $user = User::where('email', 'legacy-owner@localhost.invalid')->firstOrFail();
        $otherUser = User::create(['name' => 'Other Owner', 'email' => Str::uuid().'@example.test', 'password' => 'password']);
        $other = Organization::create(['name' => 'Other tenant', 'slug' => 'other-'.Str::random(8), 'owner_user_id' => $otherUser->id]);
        Project::create(['organization_id' => $other->id, 'name' => 'Private project', 'slug' => 'private-'.Str::random(8), 'status' => 'live', 'business_profile' => []]);
        Project::create(['organization_id' => $user->current_organization_id, 'name' => 'Visible project', 'slug' => 'visible-'.Str::random(8), 'status' => 'draft', 'business_profile' => []]);

        $this->getJson('/api/dashboard/overview')->assertOk()
            ->assertJsonPath('data.metrics.total_projects', 1)
            ->assertJsonPath('data.recent_projects.0.name', 'Visible project')
            ->assertJsonMissing(['name' => 'Private project']);
    }

    public function test_profile_update_persists_preferences_and_requires_password_for_email_change(): void
    {
        $user = User::where('email', 'legacy-owner@localhost.invalid')->firstOrFail();
        $this->patchJson('/api/profile', ['first_name' => 'Casey', 'last_name' => 'Owner', 'notification_preferences' => ['generation_failed' => false, 'security_notices' => false]])->assertOk()
            ->assertJsonPath('data.first_name', 'Casey')->assertJsonPath('data.notification_preferences.generation_failed', false)->assertJsonPath('data.notification_preferences.security_notices', true);
        $this->patchJson('/api/profile', ['email' => 'changed@example.test'])->assertUnprocessable();
        $this->patchJson('/api/profile', ['email' => 'changed@example.test', 'current_password' => 'wrong'])->assertUnprocessable();
        $user->forceFill(['password' => Hash::make('known-password')])->save();
        $this->actingAs($user->fresh());
        $this->patchJson('/api/profile', ['email' => 'changed@example.test', 'current_password' => 'known-password'])->assertOk()->assertJsonPath('data.email_verified_at', null);
    }
}
