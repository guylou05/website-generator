<?php

namespace Tests\Unit;

use App\Support\EnvironmentValidator;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

class EnvironmentValidatorTest extends TestCase
{
    #[Test]
    public function railway_reference_urls_are_valid_infrastructure_configuration(): void
    {
        $errors = (new EnvironmentValidator)->errors([
            'APP_URL' => 'https://api.example.com',
            'APP_KEY' => 'base64:test',
            'DB_CONNECTION' => 'pgsql',
            'DB_URL' => 'postgresql://railway.internal/database',
            'REDIS_URL' => 'redis://railway.internal:6379',
            'SESSION_DRIVER' => 'redis',
            'SESSION_SECURE_COOKIE' => 'true',
            'SESSION_SAME_SITE' => 'none',
            'SANCTUM_STATEFUL_DOMAINS' => 'dashboard.example.com',
            'DASHBOARD_URL' => 'https://dashboard.example.com',
        ]);

        $this->assertSame([], $errors);
    }

    #[Test]
    public function missing_infrastructure_returns_actionable_errors(): void
    {
        $errors = (new EnvironmentValidator)->errors([
            'APP_URL' => 'https://api.example.com',
            'APP_KEY' => 'base64:test',
            'DB_CONNECTION' => 'pgsql',
            'SESSION_DRIVER' => 'redis',
            'SANCTUM_STATEFUL_DOMAINS' => 'dashboard.example.com',
            'DASHBOARD_URL' => 'https://dashboard.example.com',
        ]);

        $this->assertContains('Redis configuration is missing: set REDIS_URL or REDIS_HOST when SESSION_DRIVER=redis.', $errors);
        $this->assertContains('Database configuration is missing: set DB_URL, DATABASE_URL, or DB_DATABASE.', $errors);
    }

    #[Test]
    public function production_rejects_invalid_and_placeholder_mail_senders(): void
    {
        $base = [
            'APP_ENV' => 'production', 'APP_URL' => 'https://api.test', 'APP_KEY' => 'base64:test',
            'DB_CONNECTION' => 'sqlite', 'SESSION_DRIVER' => 'array',
            'SANCTUM_STATEFUL_DOMAINS' => 'dashboard.test', 'DASHBOARD_URL' => 'https://dashboard.test',
            'MAIL_MAILER' => 'smtp', 'MAIL_FROM_NAME' => 'SiteFoundry',
        ];
        $invalid = (new EnvironmentValidator)->errors($base + ['MAIL_FROM_ADDRESS' => 'hello@<YOUR_DOMAIN>']);
        $placeholder = (new EnvironmentValidator)->errors($base + ['MAIL_FROM_ADDRESS' => 'noreply@example.com']);

        $this->assertContains('MAIL_FROM_ADDRESS must be a valid RFC-compliant email address (for example, noreply@example.com).', $invalid);
        $this->assertContains('MAIL_FROM_ADDRESS must not contain a placeholder value in production.', $placeholder);
    }
}
