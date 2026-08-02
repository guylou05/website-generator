<?php

namespace App\Services;

use App\Models\WordPressConnection;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;
use InvalidArgumentException;
use RuntimeException;
use Throwable;

class WordPressConnectionService
{
    public function normalize(string $value): string
    {
        $url = rtrim(trim($value), '/');
        if (! filter_var($url, FILTER_VALIDATE_URL) || ! in_array(parse_url($url, PHP_URL_SCHEME), ['http', 'https'], true)) {
            throw new InvalidArgumentException('Enter a valid WordPress site URL.');
        }
        $path = strtolower(rtrim((string) parse_url($url, PHP_URL_PATH), '/'));
        if (str_ends_with($path, '/wp-admin') || str_ends_with($path, '/wp-json')) {
            throw new InvalidArgumentException('Enter the WordPress base URL, not a wp-admin or wp-json URL.');
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
            $http = Http::timeout((int) config('app.wordpress_timeout', 15))->maxRedirects(0)->acceptJson();
            $http = $connection->authentication_type === 'connector'
                ? $http->withToken($connection->encrypted_connector_token)
                : $http->withBasicAuth($connection->username, $connection->encrypted_application_password);
            $response = $http->get($connection->site_url.'/wp-json/website-generator/v1/health');
            $response->throw();
            $health = $response->json();
            if (! is_array($health) || ! isset($health['connected'], $health['wordpress'], $health['plugin'], $health['elementor'])) {
                throw new RuntimeException('malformed_health_response');
            }
            if (! $health['connected']) {
                throw new RuntimeException((string) ($health['error']['code'] ?? 'connector_unavailable'));
            }
            $result = [
                'connected' => true,
                'wordpress_version' => $health['wordpress']['version'] ?? null,
                'elementor' => $health['elementor'],
                'connector' => ['installed' => true, 'active' => true, 'version' => $health['plugin']['version'] ?? null],
                'permissions' => $health['capabilities'] ?? [],
            ];
            $connection->update([
                'wordpress_version' => $result['wordpress_version'], 'elementor_version' => $result['elementor']['version'] ?? null,
                'connector_version' => $result['connector']['version'], 'status' => 'verified', 'last_verified_at' => now(),
                'last_tested_at' => now(), 'last_error' => null,
            ]);

            return $result;
        } catch (Throwable $e) {
            $safe = $this->safeError($e);
            $connection->update(['status' => 'failed', 'last_tested_at' => now(), 'last_error' => $safe]);
            throw new RuntimeException($safe['message']);
        }
    }

    private function safeError(Throwable $e): array
    {
        $status = $e instanceof RequestException ? $e->response->status() : null;
        if ($status === 404) {
            return ['code' => 'connector_route_not_found', 'message' => 'Connector route not found.', 'http_status' => 404];
        }
        if ($status === 401 || $status === 403) {
            return ['code' => 'connector_token_rejected', 'message' => 'Connector token rejected.', 'http_status' => $status];
        }
        if ($e->getMessage() === 'elementor_inactive') {
            return ['code' => 'elementor_inactive', 'message' => 'Elementor is not active.', 'http_status' => 200];
        }
        if ($e->getMessage() === 'elementor_not_installed') {
            return ['code' => 'elementor_not_installed', 'message' => 'Elementor is not installed.', 'http_status' => 200];
        }
        if ($e->getMessage() === 'malformed_health_response') {
            return ['code' => 'malformed_health_response', 'message' => 'The connector returned an invalid health response.', 'http_status' => 200];
        }
        if ($e instanceof ConnectionException) {
            $message = strtolower($e->getMessage());
            if (str_contains($message, 'timed out') || str_contains($message, 'timeout')) {
                return ['code' => 'request_timed_out', 'message' => 'Request timed out.', 'http_status' => null];
            }
            if (str_contains($message, 'ssl') || str_contains($message, 'certificate')) {
                return ['code' => 'tls_verification_failed', 'message' => 'TLS verification failed.', 'http_status' => null];
            }

            return ['code' => 'wordpress_rest_unavailable', 'message' => 'WordPress REST API is unavailable.', 'http_status' => null];
        }

        return ['code' => 'wordpress_rest_unavailable', 'message' => 'WordPress REST API is unavailable.', 'http_status' => $status];
    }
}
