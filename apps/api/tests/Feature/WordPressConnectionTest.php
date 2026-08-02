<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\WordPressConnection;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
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
        Http::fake([
            '*/wp-json' => Http::response(['routes' => ['/website-generator/v1/menus' => [], '/website-generator/v1/settings/homepage' => [], '/website-generator/v1/elementor/regenerate-css' => []]]),
            '*/users/me*' => Http::response(['capabilities' => ['edit_pages' => true, 'publish_pages' => true, 'upload_files' => true, 'manage_options' => true]]),
            '*/status' => Http::response(['wordpress' => ['version' => '6.8'], 'connector' => ['version' => '1.0'], 'elementor' => ['available' => true, 'version' => '3.30']]),
        ]);
        $connection = $this->project()->wordpressConnections()->create(['site_url' => 'http://wordpress.test', 'username' => 'admin', 'encrypted_application_password' => 'secret']);
        $this->postJson('/api/wordpress-connections/'.$connection->id.'/verify')->assertOk()->assertJsonPath('data.status', 'verified')->assertJsonPath('data.elementor_version', '3.30');
    }

    public function test_missing_connector_returns_safe_error(): void
    {
        Http::fake(['*' => Http::response([], 404)]);
        $connection = $this->project()->wordpressConnections()->create(['site_url' => 'http://wordpress.test', 'username' => 'admin', 'encrypted_application_password' => 'secret']);
        $this->postJson('/api/wordpress-connections/'.$connection->id.'/verify')->assertStatus(422)->assertJsonPath('error.code', 'connection_verification_failed')->assertJsonMissing(['secret']);
    }
}
