<?php

return [
    'default' => env('FILESYSTEM_DISK', 'local'),
    'disks' => [
        'local' => ['driver' => 'local', 'root' => storage_path('app/private'), 'serve' => true, 'throw' => false],
        'media' => ['driver' => 'local', 'root' => storage_path('app/media'), 'serve' => true, 'visibility' => 'private', 'throw' => true],
        'media-s3' => [
            'driver' => 's3', 'key' => env('MEDIA_S3_ACCESS_KEY_ID'), 'secret' => env('MEDIA_S3_SECRET_ACCESS_KEY'),
            'region' => env('MEDIA_S3_REGION', 'us-east-1'), 'bucket' => env('MEDIA_S3_BUCKET'),
            'endpoint' => env('MEDIA_S3_ENDPOINT'), 'use_path_style_endpoint' => env('MEDIA_S3_PATH_STYLE', false),
            'url' => env('MEDIA_PUBLIC_BASE_URL'), 'visibility' => 'private', 'throw' => true,
        ],
    ],
];
