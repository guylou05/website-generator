<?php

namespace App\Services;

use App\Models\Deployment;
use Illuminate\Support\Facades\Http;
use Throwable;

class DeploymentService
{
    private const STAGES = ['Validating output', 'Verifying WordPress connection', 'Uploading media', 'Creating or updating pages', 'Applying Elementor data', 'Creating navigation', 'Configuring homepage', 'Regenerating Elementor CSS', 'Verifying deployed site'];

    public function execute(Deployment $deployment, bool $bypassPreview = false): Deployment
    {
        if (! $deployment->dry_run && ! $bypassPreview && ! Deployment::where(['project_id' => $deployment->project_id, 'website_revision_id' => $deployment->website_revision_id, 'wordpress_connection_id' => $deployment->wordpress_connection_id, 'dry_run' => true, 'status' => 'completed'])->exists()) {
            return $this->fail($deployment, 'preview_required', 'Run a successful deployment preview first.');
        }
        $deployment->update(['status' => 'running', 'started_at' => now(), 'completed_at' => null, 'error' => null]);
        try {
            $revision = $deployment->websiteRevision;
            if (! $revision || $revision->status !== 'approved' || empty($revision->blueprint['pages']) || empty($revision->elementor_output)) {
                throw new \RuntimeException('Approved revision output is incomplete or invalid.');
            }
            $connection = $deployment->connection;
            $pages = $revision->blueprint['pages'];
            $documents = collect($revision->elementor_output['documents'] ?? [])->keyBy('page');
            $operations = [];
            $ids = [];
            foreach (self::STAGES as $index => $stage) {
                if ($deployment->fresh()->status === 'cancelled') {
                    return $deployment->fresh('events');
                }
                $progress = (int) round((($index + 1) / count(self::STAGES)) * 100);
                $deployment->update(['current_stage' => $stage, 'progress' => $progress]);
                if ($stage === 'Verifying WordPress connection') {
                    app(WordPressConnectionService::class)->verify($connection);
                }
                if ($stage === 'Creating or updating pages') {
                    foreach ($pages as $page) {
                        $slug = trim($page['slug'] ?? $page['id'], '/');
                        if ($slug === '') {
                            $slug = 'home';
                        }
                        $existing = $this->request($connection, 'GET', '/wp-json/wp/v2/pages', ['slug' => $slug, 'context' => 'edit']);
                        $current = $existing[0] ?? null;
                        $action = $current ? 'update' : 'create';
                        $operations[] = ['action' => $action, 'resource' => 'page', 'identifier' => $page['id'], 'details' => ['slug' => $slug]];
                        if (! $deployment->dry_run) {
                            $payload = ['title' => $page['title'] ?? ucfirst($slug), 'slug' => $slug, 'status' => 'publish'];
                            $saved = $this->request($connection, 'POST', '/wp-json/wp/v2/pages'.($current ? '/'.$current['id'] : ''), $payload);
                            $ids[$page['id']] = $saved['id'];
                        }
                    }
                }
                if ($stage === 'Applying Elementor data') {
                    foreach ($ids as $pageId => $wordpressId) {
                        $this->request($connection, 'POST', "/wp-json/website-generator/v1/pages/$wordpressId/elementor", ['data' => $documents->get($pageId)['elements'] ?? [], 'settings' => []]);
                    }
                }
                if ($stage === 'Creating navigation') {
                    $operations[] = ['action' => 'configure', 'resource' => 'menu', 'identifier' => 'Primary Navigation'];
                    if (! $deployment->dry_run) {
                        $this->request($connection, 'POST', '/wp-json/website-generator/v1/menus', ['name' => 'Primary Navigation', 'items' => collect($pages)->map(fn ($p) => ['key' => $p['id'], 'title' => $p['title'] ?? ucfirst($p['id']), 'url' => '/'.trim($p['slug'] ?? $p['id'], '/'), 'pageId' => $ids[$p['id']] ?? null])->all()]);
                    }
                }
                if ($stage === 'Configuring homepage') {
                    $home = collect($pages)->first(fn ($p) => trim($p['slug'] ?? '', '/') === '') ?? $pages[0];
                    $operations[] = ['action' => 'configure', 'resource' => 'homepage', 'identifier' => $home['id']];
                    if (! $deployment->dry_run) {
                        $this->request($connection, 'POST', '/wp-json/website-generator/v1/settings/homepage', ['page_id' => $ids[$home['id']]]);
                    }
                }
                if ($stage === 'Regenerating Elementor CSS' && ! $deployment->dry_run) {
                    $this->request($connection, 'POST', '/wp-json/website-generator/v1/elementor/regenerate-css', []);
                }
                $deployment->events()->create(['stage' => $stage, 'event_type' => 'stage.completed', 'progress' => $progress, 'message' => $stage.' completed', 'created_at' => now()]);
            }
            $result = ['site_url' => $connection->site_url, 'admin_url' => $connection->site_url.'/wp-admin/', 'pages' => count($pages), 'dry_run' => $deployment->dry_run, 'revision_id' => $revision->id, 'revision_number' => $revision->revision_number];
            $deployment->update(['status' => 'completed', 'progress' => 100, 'current_stage' => null, 'operations' => $operations, 'result' => $result, 'completed_at' => now()]);

            return $deployment->fresh('events');
        } catch (Throwable $e) {
            return $this->fail($deployment, 'deployment_failed', 'Deployment could not be completed. Verify the connection and retry.');
        }
    }

    private function request($connection, string $method, string $path, array $data): array
    {
        $request = Http::timeout((int) config('app.wordpress_timeout', 15))->acceptJson()->withBasicAuth($connection->username, $connection->encrypted_application_password);
        $response = $method === 'GET' ? $request->get($connection->site_url.$path, $data) : $request->post($connection->site_url.$path, $data);

        return $response->throw()->json() ?? [];
    }

    private function fail(Deployment $deployment, string $code, string $message): Deployment
    {
        $error = ['code' => $code, 'message' => $message];
        $deployment->events()->create(['stage' => $deployment->current_stage ?? 'initialization', 'event_type' => 'deployment.failed', 'progress' => $deployment->progress, 'message' => $message, 'created_at' => now()]);
        $deployment->update(['status' => 'failed', 'error' => $error, 'completed_at' => now()]);

        return $deployment->fresh('events');
    }
}
