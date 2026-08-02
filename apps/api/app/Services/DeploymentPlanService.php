<?php

namespace App\Services;

use App\Models\WordPressConnection;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class DeploymentPlanService
{
    public function snapshot(WordPressConnection $connection): array
    {
        $http = Http::timeout((int) config('app.wordpress_timeout', 15))->maxRedirects(0)->acceptJson();
        $http = $this->authenticate($http, $connection);
        $response = $http->get(rtrim($connection->site_url, '/').'/wp-json/website-generator/v1/snapshot');
        if (! $response->successful() || ! is_array($response->json())) {
            throw new RuntimeException('The read-only WordPress snapshot could not be collected.');
        }

        return $response->json();
    }

    public function compare(array $blueprint, array $elementor, array $snapshot): array
    {
        $changes = [];
        $existing = collect($snapshot['pages'] ?? [])->keyBy(fn ($page) => trim($page['slug'] ?? '', '/') ?: 'home');
        foreach ($blueprint['pages'] ?? [] as $page) {
            $slug = trim($page['slug'] ?? '', '/') ?: 'home';
            $current = $existing->get($slug);
            $this->add($changes, 'page', $current ? (($current['title'] ?? '') === $page['title'] ? 'unchanged' : 'update') : 'create', $slug, $page['title'], true, $current ? 'Existing page compared by slug and title.' : 'Page does not exist.', $current ? ['title' => $current['title'] ?? '', 'slug' => $current['slug'] ?? $slug, 'status' => $current['status'] ?? null] : null, ['title' => $page['title'], 'slug' => $slug, 'status' => $page['status'] ?? 'draft']);
            $document = $elementor[$page['id']] ?? $elementor[$slug] ?? null;
            if ($document !== null) {
                $beforeDocument = $current['elementorDocument'] ?? null;
                $this->add($changes, 'elementor', ! $current ? 'create' : (($current['elementorHash'] ?? '') === hash('sha256', $this->stable($document)) || ($beforeDocument !== null && $this->stable($beforeDocument) === $this->stable($document)) ? 'unchanged' : 'update'), $slug, $page['title'].' layout', (bool) ($snapshot['elementor']['active'] ?? false), 'Elementor sections, containers, widgets, styling, images, forms, and buttons were compared.', $this->elementorOutline($beforeDocument), $this->elementorOutline($document), ['document' => ['before' => $beforeDocument, 'after' => $document]]);
            }
            $sameSeo = $current && $this->stable($current['seo'] ?? []) === $this->stable($page['seo'] ?? []);
            $this->add($changes, 'seo', $sameSeo ? 'unchanged' : 'update', $slug, $page['title'].' SEO', true, $sameSeo ? 'SEO metadata matches.' : 'SEO title, description, and social metadata were compared.', $current['seo'] ?? null, $page['seo'] ?? []);
        }
        foreach ($blueprint['media'] ?? [] as $asset) {
            $filename = $asset['filename'] ?? basename(parse_url($asset['url'] ?? '', PHP_URL_PATH) ?: 'media');
            $match = collect($snapshot['media'] ?? [])->first(fn ($item) => (! empty($asset['hash']) && ($item['hash'] ?? null) === $asset['hash']) || ($item['filename'] ?? '') === $filename);
            $this->add($changes, 'media', $match ? 'unchanged' : 'create', $filename, $asset['alt'] ?? $filename, true, $match ? 'Existing media will be reused; no upload is needed.' : 'No matching filename or content hash was found; this media will be uploaded.', $match, $asset, ['decision' => $match ? 'reuse' : 'upload']);
        }
        $items = collect($blueprint['navigation']['items'] ?? [])->map(fn ($item) => ['title' => $item['label'], 'url' => $item['href']])->values()->all();
        $menu = collect($snapshot['menus'] ?? [])->firstWhere('name', 'Primary Navigation');
        $this->add($changes, 'menu', ! $menu ? 'create' : ($this->stable(collect($menu['items'] ?? [])->map->only(['title', 'url'])->all()) === $this->stable($items) ? 'unchanged' : 'update'), 'Primary Navigation', 'Primary navigation', true, 'Navigation order, titles and URLs were compared.', $menu['items'] ?? [], $items);
        $home = collect($blueprint['pages'] ?? [])->first(fn ($page) => (trim($page['slug'] ?? '', '/') ?: 'home') === 'home') ?? ($blueprint['pages'][0] ?? null);
        if ($home) {
            $homeSlug = trim($home['slug'] ?? '', '/') ?: 'home';
            $existingHome = $existing->get($homeSlug);
            $sameHome = $existingHome && ($snapshot['homepage']['showOnFront'] ?? null) === 'page' && (int) ($snapshot['homepage']['pageId'] ?? 0) === (int) ($existingHome['id'] ?? -1);
            $this->add($changes, 'homepage', $sameHome ? 'unchanged' : 'configure', $homeSlug, 'Static homepage', true, $sameHome ? 'The intended page is already the static homepage.' : 'WordPress reading settings will select the intended page as the static homepage.', $snapshot['homepage'] ?? null, ['showOnFront' => 'page', 'pageSlug' => $homeSlug]);
        }
        if (collect($changes)->contains(fn ($x) => $x['resource'] === 'elementor' && $x['action'] !== 'unchanged')) {
            $this->add($changes, 'css', 'regenerate', 'elementor-css', 'Elementor CSS cache', (bool) ($snapshot['elementor']['active'] ?? false), 'Changed layouts require a read-only planned CSS regeneration step.', ['state' => 'existing cache'], ['state' => 'regenerate after deployment']);
        }
        foreach ($blueprint['settings'] ?? [] as $key => $value) {
            $before = $snapshot['settings'][$key] ?? null;
            $same = $this->stable($before) === $this->stable($value);
            $this->add($changes, 'settings', $same ? 'unchanged' : 'configure', (string) $key, ucwords(str_replace(['_', '-'], ' ', (string) $key)), true, $same ? 'Site setting matches.' : 'Site setting differs.', $before, $value);
        }
        $actions = ['create', 'update', 'delete', 'unchanged', 'regenerate', 'configure'];
        $stats = ['total' => count($changes)];
        foreach ($actions as $action) {
            $stats[$action] = collect($changes)->where('action', $action)->count();
        }
        $warnings = collect($changes)->where('safe', false)->pluck('reason')->unique()->values()->all();

        if (! ($snapshot['elementor']['active'] ?? false) && collect($changes)->contains(fn ($x) => $x['resource'] === 'elementor')) {
            $warnings[] = 'Elementor is not active on the target site.';
        }

        return ['changes' => $changes, 'statistics' => $stats, 'warnings' => array_values(array_unique($warnings)), 'safety_status' => collect($changes)->contains(fn ($x) => ! $x['safe']) ? 'blocked' : ($warnings ? 'warning' : 'safe'), 'estimated_seconds' => max(5, collect($changes)->where('action', '!=', 'unchanged')->sum(fn ($change) => $change['resource'] === 'media' ? 8 : 3))];
    }

    private function add(array &$changes, string $resource, string $action, string $identifier, string $label, bool $safe, string $reason, mixed $before = null, mixed $after = null, array $details = []): void
    {
        $changes[] = compact('resource', 'action', 'identifier', 'label', 'safe', 'reason', 'before', 'after', 'details');
    }

    private function elementorOutline(mixed $document): array
    {
        $counts = ['sections' => 0, 'containers' => 0, 'widgets' => 0, 'images' => 0, 'forms' => 0, 'buttons' => 0, 'styledElements' => 0];
        $walk = function (mixed $node) use (&$walk, &$counts): void {
            if (! is_array($node)) {
                return;
            }
            $type = strtolower((string) ($node['elType'] ?? $node['type'] ?? ''));
            $widget = strtolower((string) ($node['widgetType'] ?? ''));
            foreach (['section' => 'sections', 'container' => 'containers', 'widget' => 'widgets'] as $needle => $count) {
                if ($type === $needle) {
                    $counts[$count]++;
                }
            }
            foreach (['image' => 'images', 'form' => 'forms', 'button' => 'buttons'] as $needle => $count) {
                if (str_contains($widget, $needle)) {
                    $counts[$count]++;
                }
            }
            if (! empty($node['settings'])) {
                $counts['styledElements']++;
            }
            foreach ($node as $value) {
                if (is_array($value)) {
                    $walk($value);
                }
            }
        };
        $walk($document);

        return $counts;
    }

    private function stable(mixed $value): string
    {
        if (is_array($value)) {
            if (! array_is_list($value)) {
                ksort($value);
            }
            foreach ($value as &$item) {
                $item = is_array($item) ? json_decode($this->stable($item), true) : $item;
            }
        }

        return json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }

    private function authenticate(PendingRequest $http, WordPressConnection $connection): PendingRequest
    {
        return $connection->authentication_type === 'connector' ? $http->withToken($connection->encrypted_connector_token) : $http->withBasicAuth($connection->username, $connection->encrypted_application_password);
    }
}
