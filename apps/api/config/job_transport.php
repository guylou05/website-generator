<?php

return [
    'generation_queue' => env('GENERATION_QUEUE_NAME', 'website-generation'),
    'deployment_queue' => env('DEPLOYMENT_QUEUE_NAME', 'wordpress-deployment'),
    'rollback_queue' => env('ROLLBACK_QUEUE_NAME', 'wordpress-rollback'),
    'media_queue' => env('MEDIA_QUEUE_NAME', 'media-processing'),
    'prefix' => trim(env('REDIS_QUEUE_PREFIX', 'sitefoundry'), ':'),
    'redis_connection' => 'queue_transport',
];
