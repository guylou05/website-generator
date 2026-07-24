<?php

namespace Tests\Unit;

use App\Support\ApplicationKey;
use PHPUnit\Framework\TestCase;

final class ApplicationKeyTest extends TestCase
{
    public function test_it_preserves_a_valid_laravel_key(): void
    {
        $key = 'base64:'.base64_encode(random_bytes(32));

        $this->assertSame($key, ApplicationKey::normalize($key));
    }

    public function test_it_derives_a_stable_key_from_a_plain_text_secret(): void
    {
        $normalized = ApplicationKey::normalize('railway-managed-secret');

        $this->assertSame($normalized, ApplicationKey::normalize('railway-managed-secret'));
        $this->assertSame(32, strlen(base64_decode(substr($normalized, 7), true)));
    }

    public function test_it_leaves_a_missing_key_missing(): void
    {
        $this->assertNull(ApplicationKey::normalize(null));
        $this->assertSame('', ApplicationKey::normalize(''));
    }
}
