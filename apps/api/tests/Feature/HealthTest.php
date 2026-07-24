<?php

namespace Tests\Feature;

use Tests\TestCase;

final class HealthTest extends TestCase
{
    public function test_root_endpoint_identifies_the_api(): void
    {
        $this->get('/')
            ->assertOk()
            ->assertJson([
                'name' => config('app.name'),
                'status' => 'ok',
                'health' => url('/api/health'),
            ]);
    }

    public function test_health_endpoint_is_available(): void
    {
        $this->get('/up')->assertOk();
    }
}
