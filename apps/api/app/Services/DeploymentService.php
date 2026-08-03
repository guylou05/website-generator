<?php

namespace App\Services;

use App\Models\Deployment;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class DeploymentService
{
    private const STAGES = ['Validating output', 'Verifying WordPress connection', 'Uploading media', 'Creating or updating pages', 'Applying Elementor data', 'Creating navigation', 'Configuring homepage', 'Regenerating Elementor CSS', 'Verifying deployed site'];

    public function execute(Deployment $deployment, bool $bypassPreview = false): Deployment
    {
        // Execution is idempotent and only immutable approved artifacts may write.
        if ($deployment->status === 'completed') {
            return $deployment->load(['events', 'items']);
        }
        $plan = $deployment->deploymentPlan;
        if ($deployment->deployment_plan_id && (! $plan || $plan->status !== 'approved' || ! $plan->verifyIntegrity())) {
            return $this->fail($deployment, 'plan_not_approved', 'Deployment plan is not approved or its checksum changed.');
        }
        if ($plan?->expires_at?->isPast()) {
            return $this->fail($deployment, 'plan_expired', 'Deployment plan has expired.');
        }
        if ($plan && ! hash_equals((string) $plan->snapshot_hash, hash('sha256', app(DeploymentApprovalService::class)->canonical($plan->snapshot)))) {
            return $this->fail($deployment, 'snapshot_changed', 'The approved snapshot checksum no longer matches.');
        }
        if (! $deployment->dry_run && ! $bypassPreview && ! Deployment::where(['project_id' => $deployment->project_id, 'website_revision_id' => $deployment->website_revision_id, 'wordpress_connection_id' => $deployment->wordpress_connection_id, 'dry_run' => true, 'status' => 'completed'])->exists()) {
            return $this->fail($deployment, 'preview_required', 'Run a successful deployment preview first.');
        }
        $deployment->update(['status' => 'running', 'started_at' => now(), 'completed_at' => null, 'error' => null]);
        Log::info('Deployment started', ['deployment_id' => $deployment->id, 'wordpress_endpoint' => $deployment->wordpressConnection?->site_url]);
        try {
            $revision = $deployment->websiteRevision;
            if (! $revision || $revision->status !== 'approved' || empty($revision->blueprint['pages']) || empty($revision->elementor_output)) {
                throw new \RuntimeException('Approved revision output is incomplete or invalid.');
            }
            $connection = $deployment->wordpressConnection;
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
                if ($stage === 'Uploading media') {
                    foreach ($revision->blueprint['media'] ?? [] as $asset) {
                        $filename = $asset['filename'] ?? basename($asset['url'] ?? 'media');
                        $matches = $this->request($connection, 'GET', '/wp-json/website-generator/v1/media', array_filter(['hash' => $asset['hash'] ?? null, 'filename' => $filename]));
                        $operations[] = ['action' => empty($matches) ? 'upload' : 'reuse', 'resource' => 'media', 'identifier' => $filename];
                        if (! $deployment->dry_run && empty($matches)) {
                            $this->request($connection, 'POST', '/wp-json/website-generator/v1/media', ['source_url' => $asset['url'] ?? null, 'filename' => $filename, 'hash' => $asset['hash'] ?? null, 'alt_text' => $asset['alt'] ?? '']);
                        }
                    }
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
                            $payload = array_filter(['title' => $page['title'] ?? ucfirst($slug), 'slug' => $slug, 'content' => $page['content'] ?? '', 'excerpt' => $page['excerpt'] ?? '', 'featured_media' => $page['featured_image_id'] ?? null, 'status' => $page['status'] ?? ($deployment->options['page_status'] ?? 'draft')], fn ($value) => $value !== null);
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
                if ($stage === 'Verifying deployed site' && ! $deployment->dry_run) {
                    foreach ($pages as $page) {
                        if (! empty($page['seo']) && isset($ids[$page['id']])) {
                            $this->request($connection, 'POST', '/wp-json/website-generator/v1/pages/'.$ids[$page['id']].'/seo', $page['seo']);
                        }
                    }
                }
                $deployment->events()->create(['stage' => $stage, 'event_type' => 'stage.completed', 'progress' => $progress, 'message' => $stage.' completed', 'created_at' => now()]);
                $deployment->increment('steps_completed');
                Log::info('Deployment step completed', ['deployment_id' => $deployment->id, 'step' => $stage]);
            }
            $result = ['site_url' => $connection->site_url, 'admin_url' => $connection->site_url.'/wp-admin/', 'pages' => count($pages), 'dry_run' => $deployment->dry_run, 'revision_id' => $revision->id, 'revision_number' => $revision->revision_number];
            $deployment->update(['status' => 'completed', 'progress' => 100, 'current_stage' => 'Completed', 'operations' => $operations, 'result' => $result, 'completed_at' => now(), 'duration_ms' => now()->diffInMilliseconds($deployment->started_at, true), 'connector_version' => $connection->connector_version, 'warnings' => $deployment->options['warnings'] ?? []]);
            Log::info('Deployment completed', ['deployment_id' => $deployment->id, 'duration_ms' => $deployment->duration_ms]);

            return $deployment->fresh('events');
        } catch (Throwable $e) {
            return $this->fail($deployment, 'deployment_failed', $e->getMessage(), $e);
        }
    }

    private function request($connection, string $method, string $path, array $data): array
    {
        $request = Http::timeout((int) config('app.wordpress_timeout', 15))->acceptJson()->withBasicAuth($connection->username, $connection->encrypted_application_password);
        $response = $method === 'GET' ? $request->get($connection->site_url.$path, $data) : $request->post($connection->site_url.$path, $data);

        return $response->throw()->json() ?? [];
    }

    private function fail(Deployment $deployment, string $code, string $message, ?Throwable $exception = null): Deployment
    {
        $error = ['code' => $code, 'message' => $message];
        $deployment->events()->create(['stage' => $deployment->current_stage ?? 'initialization', 'event_type' => 'deployment.failed', 'progress' => $deployment->progress, 'message' => $message, 'created_at' => now()]);
        $response = $exception && method_exists($exception, 'response') && $exception->response ? ['status' => $exception->response->status(), 'body' => $exception->response->json() ?? $exception->response->body()] : null;
        $deployment->update(['status' => 'failed', 'error' => $error, 'error_details' => ['failed_step' => $deployment->current_stage, 'exception' => $exception?->getMessage(), 'stack' => $exception?->getTraceAsString(), 'connector_response' => $response], 'failed_at' => now(), 'completed_at' => now(), 'duration_ms' => $deployment->started_at ? now()->diffInMilliseconds($deployment->started_at, true) : 0]);
        Log::error('Deployment failed', ['deployment_id' => $deployment->id, 'failed_step' => $deployment->current_stage, 'reason' => $message, 'connector_response' => $response]);

        return $deployment->fresh('events');
    }
}
