<?php

return [
    'generation_queue' => env('GENERATION_QUEUE_NAME', 'website-generation'),
    'deployment_queue' => env('DEPLOYMENT_QUEUE_NAME', 'wordpress-deployment'),
    'prefix' => trim(env('REDIS_QUEUE_PREFIX', 'sitefoundry'), ':'),
    'redis_connection' => 'queue_transport',
];
