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
        $connection->shouldReceive('lpush')->once()->with('sitefoundry:queue:website-generation', Mockery::on(function (string $json): bool {
            $payload = json_decode($json, true);

            return $payload['version'] === 1
                && $payload['type'] === 'generation'
                && $payload['uuid'] === '123e4567-e89b-42d3-a456-426614174000'
                && $payload['attempt'] === 1;
        }));

        app(JobTransport::class)->generation('123e4567-e89b-42d3-a456-426614174000');
    }
}
