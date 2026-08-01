<?php

namespace Tests\Feature;

use App\Jobs\SendWelcomeEmail;
use App\Models\Organization;
use App\Models\OrganizationMembership;
use App\Models\User;
use App\Notifications\QueuedVerifyEmail;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class RegistrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_registration_is_atomic_authenticates_and_queues_mail(): void
    {
        Notification::fake();
        Bus::fake([SendWelcomeEmail::class]);

        $response = $this->withHeader('Origin', 'http://localhost:3000')->postJson('/api/auth/register', [
            'name' => 'New Customer', 'email' => 'customer@example.test',
            'password' => 'Strong-password-123!', 'password_confirmation' => 'Strong-password-123!',
        ]);

        $response->assertCreated()->assertJsonPath('data.email_verification_pending', true)->assertJsonPath('data.current_role', 'owner');
        $user = User::where('email', 'customer@example.test')->firstOrFail();
        $this->assertAuthenticatedAs($user);
        $this->assertNotNull($user->current_organization_id);
        $this->assertDatabaseHas('organizations', ['id' => $user->current_organization_id, 'owner_user_id' => $user->id]);
        $this->assertDatabaseHas('organization_memberships', ['organization_id' => $user->current_organization_id, 'user_id' => $user->id, 'role' => 'owner', 'status' => 'active']);
        Notification::assertSentTo($user, QueuedVerifyEmail::class);
        Bus::assertDispatched(SendWelcomeEmail::class, fn ($job) => $job->userId === $user->id);
    }

    public function test_duplicate_email_returns_structured_validation_error(): void
    {
        User::create(['name' => 'Existing', 'email' => 'duplicate@example.test', 'password' => 'Strong-password-123!']);

        $this->postJson('/api/auth/register', [
            'name' => 'Duplicate', 'email' => 'duplicate@example.test',
            'password' => 'Strong-password-123!', 'password_confirmation' => 'Strong-password-123!',
        ])->assertStatus(422)->assertJsonPath('error.code', 'validation_failed')->assertJsonPath('error.details.email.0', 'The email has already been taken.');
    }

    public function test_repair_command_reports_and_fixes_missing_registration_relationships(): void
    {
        $user = User::create(['name' => 'Interrupted', 'email' => 'interrupted@example.test', 'password' => 'Strong-password-123!']);

        $this->artisan('users:repair-registration --dry-run')->assertSuccessful()->expectsOutputToContain("User {$user->id} has no organization.");
        $this->assertSame(0, Organization::where('owner_user_id', $user->id)->count());

        $this->artisan('users:repair-registration --fix')->assertSuccessful();
        $user->refresh();
        $this->assertNotNull($user->current_organization_id);
        $this->assertTrue(OrganizationMembership::where('organization_id', $user->current_organization_id)->where('user_id', $user->id)->where('role', 'owner')->exists());
    }
}
