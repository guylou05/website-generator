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

        $production = $value('APP_ENV', 'local') === 'production';
        $mailer = (string) $value('MAIL_MAILER', 'log');
        $fromAddress = trim((string) $value('MAIL_FROM_ADDRESS', $production ? '' : 'noreply@example.com'));
        $fromName = trim((string) $value('MAIL_FROM_NAME', $production ? '' : 'SiteFoundry'));
        if (! filter_var($fromAddress, FILTER_VALIDATE_EMAIL)) {
            $errors[] = 'MAIL_FROM_ADDRESS must be a valid RFC-compliant email address (for example, noreply@example.com).';
        }
        if ($production && $this->isPlaceholderEmail($fromAddress)) {
            $errors[] = 'MAIL_FROM_ADDRESS must not contain a placeholder value in production.';
        }
        if ($production && $fromName === '') {
            $errors[] = 'MAIL_FROM_NAME must not be empty in production.';
        }
        if ($production && $mailer === 'log') {
            $errors[] = 'MAIL_MAILER=log is only suitable for non-production environments.';
        }
        if ($production && $value('QUEUE_CONNECTION', 'sync') === 'sync') {
            $errors[] = 'QUEUE_CONNECTION must use an asynchronous driver in production.';
        }

        return $errors;
    }

    private function isPlaceholderEmail(string $email): bool
    {
        $lower = strtolower($email);

        return str_contains($lower, '<') || str_contains($lower, '>')
            || str_contains($lower, 'your_domain') || str_contains($lower, 'your-domain')
            || str_contains($lower, 'placeholder') || str_ends_with($lower, '@example.com')
            || str_ends_with($lower, '@example.org') || str_ends_with($lower, '@example.net');
    }
}
