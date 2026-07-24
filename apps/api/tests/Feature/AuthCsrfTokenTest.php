<?php

namespace Tests\Feature;

use Tests\TestCase;

class AuthCsrfTokenTest extends TestCase
{
    public function test_dashboard_can_request_a_csrf_token_for_cross_origin_requests(): void
    {
        $response = $this
            ->withHeader('Origin', 'http://localhost:3000')
            ->getJson('/api/auth/csrf-token');

        $response
            ->assertOk()
            ->assertJsonStructure(['data' => ['token']]);

        $this->assertNotEmpty($response->json('data.token'));
    }
}
