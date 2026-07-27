<?php

namespace App\Support;

class EnvironmentValidator
{
    /** @return list<string> */
    public function errors(?array $environment = null): array
    {
        $value = static fn (string $key, mixed $default = null): mixed => $environment !== null
            ? ($environment[$key] ?? $default)
            : env($key, $default);
        $errors = [];
        foreach (['APP_URL' => 'public API URL', 'APP_KEY' => 'Laravel encryption key', 'DB_CONNECTION' => 'database connection'] as $key => $label) {
            if (! $value($key)) {
                $errors[] = "$key is missing ($label).";
            }
        }
        if ($value('SESSION_DRIVER', 'redis') === 'redis' && ! $value('REDIS_URL') && ! $value('REDIS_HOST')) {
            $errors[] = 'Redis configuration is missing: set REDIS_URL or REDIS_HOST when SESSION_DRIVER=redis.';
        }
        if ($value('DB_CONNECTION') !== 'sqlite' && ! $value('DB_URL') && ! $value('DATABASE_URL') && ! $value('DB_DATABASE')) {
            $errors[] = 'Database configuration is missing: set DB_URL, DATABASE_URL, or DB_DATABASE.';
        }

        $domain = (string) $value('SESSION_DOMAIN', '');
        if (str_contains($domain, '://') || str_contains($domain, '/') || str_contains($domain, ':')) {
            $errors[] = 'SESSION_DOMAIN must be a hostname only (no scheme, path, or port).';
        }
        if ($value('SESSION_SAME_SITE') === 'none' && ! filter_var($value('SESSION_SECURE_COOKIE'), FILTER_VALIDATE_BOOL)) {
            $errors[] = 'SESSION_SECURE_COOKIE must be true when SESSION_SAME_SITE=none.';
        }
        if ($value('AUTH_DRIVER', 'sanctum') === 'sanctum' && ! $value('SANCTUM_STATEFUL_DOMAINS')) {
            $errors[] = 'SANCTUM_STATEFUL_DOMAINS is required for cookie authentication.';
        }
        if (! $value('DASHBOARD_URL') && ! $value('CORS_ALLOWED_ORIGINS')) {
            $errors[] = 'DASHBOARD_URL or CORS_ALLOWED_ORIGINS must identify the dashboard.';
        }

        return $errors;
    }
}
