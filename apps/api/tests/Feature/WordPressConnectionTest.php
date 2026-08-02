<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\Project;
use App\Models\User;
use App\Models\WordPressConnection;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\TestCase;

class WordPressConnectionTest extends TestCase
{
    use RefreshDatabase;

    private function project(): Project
    {
        return Project::create(['name' => 'Acme', 'slug' => 'acme', 'status' => 'ready', 'business_profile' => []]);
    }

    public function test_password_is_encrypted_and_redacted(): void
    {
        $response = $this->postJson('/api/projects/'.$this->project()->id.'/wordpress-connections', ['site_url' => 'http://localhost:8080/', 'username' => 'admin', 'application_password' => 'secret value'])->assertCreated();
        $response->assertJsonMissing(['secret value'])->assertJsonMissing(['encrypted_application_password']);
        $connection = WordPressConnection::firstOrFail();
        $this->assertSame('secret value', $connection->encrypted_application_password);
        $this->assertStringNotContainsString('secret value', DB::table('wordpress_connections')->value('encrypted_application_password'));
    }

    public function test_connector_authentication_requires_only_a_connector_token(): void
    {
        $response = $this->postJson('/api/projects/'.$this->project()->id.'/wordpress-connections', [
            'site_url' => 'https://wordpress.test',
            'authentication_type' => 'connector',
            'connector_token' => 'connector secret',
        ])->assertCreated();

        $response->assertJsonMissing(['connector secret'])->assertJsonMissing(['encrypted_connector_token']);
        $connection = WordPressConnection::firstOrFail();
        $this->assertSame('connector', $connection->authentication_type);
        $this->assertNull($connection->username);
        $this->assertNull($connection->encrypted_application_password);
        $this->assertSame('connector secret', $connection->encrypted_connector_token);
    }

    public function test_connector_authentication_prohibits_application_password_credentials(): void
    {
        $project = $this->project();

        $this->postJson('/api/projects/'.$project->id.'/wordpress-connections', [
            'site_url' => 'https://wordpress.test',
            'authentication_type' => 'connector',
            'username' => 'admin',
            'application_password' => 'secret',
            'connector_token' => 'connector secret',
        ])->assertUnprocessable()
            ->assertJsonPath('error.code', 'validation_failed')
            ->assertJsonStructure(['error' => ['details' => ['username', 'application_password']]]);

        $this->postJson('/api/projects/'.$project->id.'/wordpress-connections', [
            'site_url' => 'https://wordpress.test',
            'authentication_type' => 'connector',
        ])->assertUnprocessable()->assertJsonStructure(['error' => ['details' => ['connector_token']]]);
    }

    public function test_application_password_authentication_requires_only_username_and_password(): void
    {
        $this->postJson('/api/projects/'.$this->project()->id.'/wordpress-connections', [
            'site_url' => 'https://wordpress.test',
            'authentication_type' => 'application_password',
            'username' => 'admin',
            'application_password' => 'secret',
        ])->assertCreated();

        $connection = WordPressConnection::firstOrFail();
        $this->assertSame('application_password', $connection->authentication_type);
        $this->assertSame('admin', $connection->username);
        $this->assertSame('secret', $connection->encrypted_application_password);
        $this->assertNull($connection->encrypted_connector_token);
    }

    public function test_application_password_authentication_prohibits_connector_token(): void
    {
        $project = $this->project();

        $this->postJson('/api/projects/'.$project->id.'/wordpress-connections', [
            'site_url' => 'https://wordpress.test',
            'authentication_type' => 'application_password',
            'username' => 'admin',
            'application_password' => 'secret',
            'connector_token' => 'connector secret',
        ])->assertUnprocessable()->assertJsonStructure(['error' => ['details' => ['connector_token']]]);

        $this->postJson('/api/projects/'.$project->id.'/wordpress-connections', [
            'site_url' => 'https://wordpress.test',
            'authentication_type' => 'application_password',
        ])->assertUnprocessable()
            ->assertJsonPath('error.code', 'validation_failed')
            ->assertJsonStructure(['error' => ['details' => ['username', 'application_password']]]);
    }

    public function test_nullable_credentials_migration_preserves_existing_connections(): void
    {
        $project = $this->project();
        $connection = $project->wordpressConnections()->create([
            'site_url' => 'https://wordpress.test',
            'authentication_type' => 'connector',
            'username' => 'legacy-placeholder',
            'encrypted_application_password' => 'legacy-placeholder',
            'encrypted_connector_token' => 'connector secret',
        ]);

        $migration = require database_path('migrations/2026_08_02_000002_make_wordpress_credentials_nullable.php');
        $migration->down();
        $migration->up();

        $this->assertDatabaseHas('wordpress_connections', [
            'id' => $connection->id,
            'authentication_type' => 'connector',
        ]);

        DB::table('wordpress_connections')->where('id', $connection->id)->update([
            'username' => null,
            'encrypted_application_password' => null,
        ]);
        $this->assertNull(DB::table('wordpress_connections')->where('id', $connection->id)->value('username'));
    }

    public function test_url_is_normalized_in_testing(): void
    {
        $this->postJson('/api/projects/'.$this->project()->id.'/wordpress-connections', ['site_url' => 'http://localhost:8080///', 'username' => 'admin', 'application_password' => 'secret'])->assertCreated()->assertJsonPath('data.site_url', 'http://localhost:8080');
    }

    public function test_verification_persists_versions_and_permissions(): void
    {
        Http::fake(['*/wp-json/website-generator/v1/health' => Http::response([
            'connected' => true, 'wordpress' => ['version' => '6.8'], 'plugin' => ['version' => '1.0'],
            'elementor' => ['installed' => true, 'active' => true, 'version' => '3.30'],
            'capabilities' => ['manage_options' => true, 'edit_pages' => true, 'upload_files' => true],
        ])]);
        $connection = $this->project()->wordpressConnections()->create(['site_url' => 'http://wordpress.test', 'authentication_type' => 'connector', 'encrypted_connector_token' => 'connector secret']);
        $this->postJson('/api/wordpress-connections/'.$connection->id.'/verify')->assertOk()->assertJsonPath('data.status', 'verified')->assertJsonPath('data.elementor_version', '3.30');
        Http::assertSent(fn ($request) => $request->url() === 'http://wordpress.test/wp-json/website-generator/v1/health' && $request->hasHeader('Authorization', 'Bearer connector secret'));
        $this->assertNotNull($connection->fresh()->last_tested_at);
    }

    public function test_missing_connector_returns_safe_error(): void
    {
        Http::fake(['*' => Http::response([], 404)]);
        $connection = $this->project()->wordpressConnections()->create(['site_url' => 'http://wordpress.test', 'username' => 'admin', 'encrypted_application_password' => 'secret']);
        $this->postJson('/api/wordpress-connections/'.$connection->id.'/verify')->assertStatus(422)->assertJsonPath('error.code', 'connector_route_not_found')->assertJsonPath('error.message', 'Connector route not found.')->assertJsonMissing(['secret']);
        $this->assertSame(404, $connection->fresh()->last_error['http_status']);
    }

    public function test_verification_reports_rejected_token(): void
    {
        Http::fake(['*' => Http::response(['code' => 'rest_not_authenticated'], 401)]);
        $connection = $this->project()->wordpressConnections()->create(['site_url' => 'http://wordpress.test', 'authentication_type' => 'connector', 'encrypted_connector_token' => 'bad token']);
        $this->postJson('/api/wordpress-connections/'.$connection->id.'/verify')->assertStatus(422)->assertJsonPath('error.code', 'connector_token_rejected');
    }

    public function test_verification_reports_malformed_health_json(): void
    {
        Http::fake(['*' => Http::response('not json', 200, ['Content-Type' => 'application/json'])]);
        $connection = $this->project()->wordpressConnections()->create(['site_url' => 'http://wordpress.test', 'authentication_type' => 'connector', 'encrypted_connector_token' => 'token']);
        $this->postJson('/api/wordpress-connections/'.$connection->id.'/verify')->assertStatus(422)->assertJsonPath('error.code', 'malformed_health_response');
    }

    public function test_verification_reports_timeout(): void
    {
        Http::fake(fn () => throw new ConnectionException('cURL error 28: Operation timed out'));
        $connection = $this->project()->wordpressConnections()->create(['site_url' => 'http://wordpress.test', 'authentication_type' => 'connector', 'encrypted_connector_token' => 'token']);
        $this->postJson('/api/wordpress-connections/'.$connection->id.'/verify')->assertStatus(422)->assertJsonPath('error.code', 'request_timed_out')->assertJsonPath('error.message', 'Request timed out.');
    }

    public function test_verification_reports_elementor_inactive(): void
    {
        Http::fake(['*' => Http::response(['connected' => false, 'wordpress' => [], 'plugin' => [], 'elementor' => ['active' => false], 'error' => ['code' => 'elementor_inactive']])]);
        $connection = $this->project()->wordpressConnections()->create(['site_url' => 'http://wordpress.test', 'authentication_type' => 'connector', 'encrypted_connector_token' => 'token']);
        $this->postJson('/api/wordpress-connections/'.$connection->id.'/verify')->assertStatus(422)->assertJsonPath('error.message', 'Elementor is not active.');
    }

    public function test_wordpress_connection_and_deployment_relationships_use_the_existing_foreign_key(): void
    {
        $project = $this->project();
        $connection = $project->wordpressConnections()->create([
            'site_url' => 'https://wordpress.test',
            'username' => 'admin',
            'encrypted_application_password' => 'secret',
        ]);
        $run = $project->generationRuns()->create(['provider' => 'test', 'status' => 'completed', 'input' => []]);
        $deployments = collect([1, 2])->map(fn (int $attempt) => $project->deployments()->create([
            'organization_id' => $project->organization_id,
            'generation_run_id' => $run->id,
            'wordpress_connection_id' => $connection->id,
            'status' => 'completed',
            'dry_run' => false,
            'attempt' => $attempt,
        ]));

        $this->assertCount(2, $connection->deployments);
        $this->assertTrue($connection->deployments->pluck('id')->contains($deployments->first()->id));
        $this->assertTrue($deployments->first()->wordpressConnection->is($connection));
        $this->assertSame('wordpress_connection_id', $connection->deployments()->getForeignKeyName());
        $this->assertSame('wordpress_connection_id', $deployments->first()->wordpressConnection()->getForeignKeyName());
    }

    public function test_with_max_deployments_uses_wordpress_connection_id(): void
    {
        $project = $this->project();
        $connection = $project->wordpressConnections()->create([
            'site_url' => 'https://wordpress.test',
            'username' => 'admin',
            'encrypted_application_password' => 'secret',
        ]);
        $run = $project->generationRuns()->create(['provider' => 'test', 'status' => 'completed', 'input' => []]);
        $project->deployments()->create([
            'organization_id' => $project->organization_id,
            'generation_run_id' => $run->id,
            'wordpress_connection_id' => $connection->id,
            'status' => 'completed',
            'dry_run' => false,
            'completed_at' => '2026-08-02 12:00:00',
        ]);
        $queries = [];
        DB::listen(function ($query) use (&$queries): void {
            $queries[] = $query->sql;
        });

        $result = WordPressConnection::withMax('deployments', 'completed_at')->findOrFail($connection->id);

        $this->assertNotNull($result->deployments_max_completed_at);
        $sql = implode("\n", $queries);
        $this->assertStringContainsString('wordpress_connection_id', $sql);
        $this->assertStringNotContainsString('word_press_connection_id', $sql);
    }

    public function test_wordpress_sites_list_succeeds_and_remains_scoped_to_the_current_organization(): void
    {
        $user = $this->app['auth']->user();
        $visible = WordPressConnection::create([
            'organization_id' => $user->current_organization_id,
            'site_url' => 'https://visible.wordpress.test',
            'username' => 'admin',
            'encrypted_application_password' => 'secret',
        ]);
        $otherUser = User::create([
            'name' => 'Other owner',
            'email' => 'other-'.Str::uuid().'@example.test',
            'password' => 'secret-password',
        ]);
        $otherOrganization = Organization::create([
            'name' => 'Other organization',
            'slug' => 'other-'.Str::uuid(),
            'owner_user_id' => $otherUser->id,
        ]);
        $hidden = WordPressConnection::create([
            'organization_id' => $otherOrganization->id,
            'site_url' => 'https://hidden.wordpress.test',
            'username' => 'admin',
            'encrypted_application_password' => 'secret',
        ]);
        $queries = [];
        DB::listen(function ($query) use (&$queries): void {
            $queries[] = $query->sql;
        });

        $response = $this->getJson('/api/wordpress-connections')->assertOk();

        $response->assertJsonFragment(['id' => $visible->id]);
        $response->assertJsonMissing(['id' => $hidden->id]);
        $sql = implode("\n", $queries);
        $this->assertStringContainsString('wordpress_connection_id', $sql);
        $this->assertStringNotContainsString('word_press_connection_id', $sql);
    }
}
