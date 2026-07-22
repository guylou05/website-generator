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
