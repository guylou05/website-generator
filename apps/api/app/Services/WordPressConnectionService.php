<?php

namespace App\Services;

use App\Models\WordPressConnection;
use Illuminate\Support\Facades\Http;
use InvalidArgumentException;
use Throwable;

class WordPressConnectionService
{
    public function normalize(string $value): string
    {
        $url = rtrim(trim($value), '/');
        if (! filter_var($url, FILTER_VALIDATE_URL) || ! in_array(parse_url($url, PHP_URL_SCHEME), ['http', 'https'], true)) {
            throw new InvalidArgumentException('Enter a valid WordPress site URL.');
        }
        if (! app()->environment(['local', 'testing']) && parse_url($url, PHP_URL_SCHEME) !== 'https') {
            throw new InvalidArgumentException('WordPress connections must use HTTPS.');
        }
        $host = strtolower((string) parse_url($url, PHP_URL_HOST));
        if (! app()->environment(['local', 'testing'])) {
            if ($host === 'localhost' || str_ends_with($host, '.local') || $host === '169.254.169.254') {
                throw new InvalidArgumentException('This WordPress destination is not allowed.');
            }
            $addresses = array_unique(array_merge(gethostbynamel($host) ?: [], array_column(dns_get_record($host, DNS_AAAA) ?: [], 'ipv6')));
            if (! $addresses || array_filter($addresses, fn ($ip) => ! filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE))) {
                throw new InvalidArgumentException('This WordPress destination is not allowed.');
            }
        }

        return $url;
    }

    public function verify(WordPressConnection $connection): array
    {
        try {
            $http = Http::timeout((int) config('app.wordpress_timeout', 15))->acceptJson()->withBasicAuth($connection->username, $connection->encrypted_application_password);
            $root = $http->get($connection->site_url.'/wp-json')->throw()->json();
            $user = $http->get($connection->site_url.'/wp-json/wp/v2/users/me', ['context' => 'edit'])->throw()->json();
            $status = $http->get($connection->site_url.'/wp-json/website-generator/v1/status')->throw()->json();
            $capabilities = $user['capabilities'] ?? [];
            foreach (['edit_pages', 'publish_pages', 'upload_files', 'manage_options'] as $capability) {
                if (empty($capabilities[$capability])) {
                    throw new \RuntimeException('The WordPress user does not have all required permissions.');
                }
            }
            if (empty($status['elementor']['available'])) {
                throw new \RuntimeException('Elementor is not installed and active.');
            }
            $routes = array_keys($root['routes'] ?? []);
            foreach (['/website-generator/v1/menus', '/website-generator/v1/settings/homepage', '/website-generator/v1/elementor/regenerate-css'] as $route) {
                if (! in_array($route, $routes, true)) {
                    throw new \RuntimeException('The connector plugin is missing required endpoints.');
                }
            }
            $result = ['wordpress_version' => $status['wordpress']['version'] ?? null, 'elementor_version' => $status['elementor']['version'] ?? null, 'connector_version' => $status['connector']['version'] ?? null];
            $connection->update($result + ['status' => 'verified', 'last_verified_at' => now(), 'last_error' => null]);

            return $result;
        } catch (Throwable $e) {
            $safe = ['code' => 'connection_verification_failed', 'message' => $this->safeMessage($e)];
            $connection->update(['status' => 'failed', 'last_error' => $safe]);
            throw new \RuntimeException($safe['message']);
        }
    }

    private function safeMessage(Throwable $e): string
    {
        $message = $e->getMessage();
        foreach (['Elementor is not installed and active.', 'The connector plugin is missing required endpoints.', 'The WordPress user does not have all required permissions.'] as $safe) {
            if (str_contains($message, $safe)) {
                return $safe;
            }
        }

        return 'Could not verify the WordPress connection. Check the URL, credentials, and required plugins.';
    }
}
