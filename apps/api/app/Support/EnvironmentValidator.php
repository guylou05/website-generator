<?php

namespace App\Support;

class EnvironmentValidator
{
    /** @return list<string> */
    public function errors(): array
    {
        $errors = [];
        foreach (['APP_URL' => 'public API URL', 'APP_KEY' => 'Laravel encryption key', 'DB_CONNECTION' => 'database connection'] as $key => $label) {
            if (! env($key)) {
                $errors[] = "$key is missing ($label).";
            }
        }
        if (in_array(env('SESSION_DRIVER', 'redis'), ['redis'], true) && ! env('REDIS_HOST')) {
            $errors[] = 'REDIS_HOST is required by SESSION_DRIVER=redis.';
        }
        if (! env('DB_DATABASE') && env('DB_CONNECTION') !== 'sqlite') {
            $errors[] = 'DB_DATABASE is missing.';
        }

        $domain = (string) env('SESSION_DOMAIN', '');
        if (str_contains($domain, '://') || str_contains($domain, '/') || str_contains($domain, ':')) {
            $errors[] = 'SESSION_DOMAIN must be a hostname only (no scheme, path, or port).';
        }
        if (env('SESSION_SAME_SITE') === 'none' && ! filter_var(env('SESSION_SECURE_COOKIE'), FILTER_VALIDATE_BOOL)) {
            $errors[] = 'SESSION_SECURE_COOKIE must be true when SESSION_SAME_SITE=none.';
        }
        if (env('AUTH_DRIVER', 'sanctum') === 'sanctum' && ! env('SANCTUM_STATEFUL_DOMAINS')) {
            $errors[] = 'SANCTUM_STATEFUL_DOMAINS is required for cookie authentication.';
        }
        if (! env('DASHBOARD_URL') && ! env('CORS_ALLOWED_ORIGINS')) {
            $errors[] = 'DASHBOARD_URL or CORS_ALLOWED_ORIGINS must identify the dashboard.';
        }

        return $errors;
    }
}
