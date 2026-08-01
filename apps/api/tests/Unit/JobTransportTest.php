<?php

namespace Tests\Unit;

use App\Services\JobTransport;
use Illuminate\Support\Facades\Redis;
use Mockery;
use Tests\TestCase;

class JobTransportTest extends TestCase
{
    public function test_generation_is_enqueued_as_interoperable_json(): void
    {
        $connection = Mockery::mock();
        Redis::shouldReceive('connection')->with('queue_transport')->once()->andReturn($connection);
        $connection->shouldReceive('eval')->once()->withArgs(function (string $script, int $keys, string $dedupe, string $queue, string $json): bool {
            $payload = json_decode($json, true);

            return $keys === 2 && $queue === 'sitefoundry:queue:website-generation'
                && $dedupe === 'sitefoundry:published:generation:123e4567-e89b-42d3-a456-426614174000:1'
                && $payload['type'] === 'generation' && $payload['resource_id'] === $payload['id']
                && $payload['attempt'] === 1 && isset($payload['created_at'], $payload['idempotency_key']);
        })->andReturn(1);

        app(JobTransport::class)->generation('123e4567-e89b-42d3-a456-426614174000');
    }
}
