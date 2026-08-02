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
        if (! $response->successful() || ! is_array($response->json())) throw new RuntimeException('The read-only WordPress snapshot could not be collected.');
        return $response->json();
    }

    public function compare(array $blueprint, array $elementor, array $snapshot): array
    {
        $changes = []; $existing = collect($snapshot['pages'] ?? [])->keyBy(fn ($page) => trim($page['slug'] ?? '', '/') ?: 'home');
        foreach ($blueprint['pages'] ?? [] as $page) {
            $slug = trim($page['slug'] ?? '', '/') ?: 'home'; $current = $existing->get($slug);
            $this->add($changes, 'page', $current ? (($current['title'] ?? '') === $page['title'] ? 'unchanged' : 'update') : 'create', $slug, $page['title'], true, $current ? 'Existing page compared by slug and title.' : 'Page does not exist.');
            $document = $elementor[$page['id']] ?? $elementor[$slug] ?? null;
            if ($document !== null) $this->add($changes, 'elementor', ! $current ? 'create' : (($current['elementorHash'] ?? '') === hash('sha256', $this->stable($document)) ? 'unchanged' : 'update'), $slug, $page['title'].' layout', (bool) ($snapshot['elementor']['active'] ?? false), 'Elementor document content was compared.');
            $sameSeo = $current && $this->stable($current['seo'] ?? []) === $this->stable($page['seo'] ?? []);
            $this->add($changes, 'seo', $sameSeo ? 'unchanged' : 'update', $slug, $page['title'].' SEO', true, $sameSeo ? 'SEO metadata matches.' : 'SEO metadata differs.');
        }
        $items = collect($blueprint['navigation']['items'] ?? [])->map(fn ($item) => ['title' => $item['label'], 'url' => $item['href']])->values()->all();
        $menu = collect($snapshot['menus'] ?? [])->firstWhere('name', 'Primary Navigation');
        $this->add($changes, 'menu', ! $menu ? 'create' : ($this->stable(collect($menu['items'])->map->only(['title', 'url'])->all()) === $this->stable($items) ? 'unchanged' : 'update'), 'Primary Navigation', 'Primary navigation', true, 'Navigation order, titles and URLs were compared.');
        if (collect($changes)->contains(fn ($x) => $x['resource'] === 'elementor' && $x['action'] !== 'unchanged')) $this->add($changes, 'css', 'regenerate', 'elementor-css', 'Elementor CSS cache', (bool) ($snapshot['elementor']['active'] ?? false), 'Changed layouts require CSS regeneration.');
        $actions = ['create', 'update', 'delete', 'unchanged', 'regenerate', 'configure']; $stats = ['total' => count($changes)]; foreach ($actions as $action) $stats[$action] = collect($changes)->where('action', $action)->count();
        $warnings = collect($changes)->where('safe', false)->pluck('reason')->unique()->values()->all();
        return ['changes' => $changes, 'statistics' => $stats, 'warnings' => $warnings, 'safety_status' => $warnings ? 'blocked' : 'safe', 'estimated_seconds' => max(5, collect($changes)->where('action', '!=', 'unchanged')->count() * 3)];
    }
    private function add(array &$changes, string $resource, string $action, string $identifier, string $label, bool $safe, string $reason): void { $changes[] = compact('resource', 'action', 'identifier', 'label', 'safe', 'reason'); }
    private function stable(mixed $value): string { if (is_array($value)) { if (! array_is_list($value)) ksort($value); foreach ($value as &$item) $item = is_array($item) ? json_decode($this->stable($item), true) : $item; } return json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE); }
    private function authenticate(PendingRequest $http, WordPressConnection $connection): PendingRequest { return $connection->authentication_type === 'connector' ? $http->withToken($connection->encrypted_connector_token) : $http->withBasicAuth($connection->username, $connection->encrypted_application_password); }
}
