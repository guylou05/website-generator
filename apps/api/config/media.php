<?php

return [
    'disk' => env('MEDIA_DISK', 'media'),
    'max_upload_mb' => (int) env('MEDIA_MAX_UPLOAD_MB', 5),
    'max_pixels' => (int) env('MEDIA_MAX_IMAGE_PIXELS', 40000000),
    'signed_url_ttl' => (int) env('MEDIA_SIGNED_URL_TTL_SECONDS', 900),
    'retention_days' => (int) env('MEDIA_ORIGINAL_RETENTION_DAYS', 30),
    'allowed_mimes' => ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/avif' => 'avif'],
    'derivative_formats' => array_filter(array_map('trim', explode(',', env('MEDIA_DERIVATIVE_FORMATS', 'webp,jpeg')))),
    'variants' => [
        'thumbnail' => ['width' => 320], 'small' => ['width' => 640], 'medium' => ['width' => 1024],
        'large' => ['width' => 1600], 'hero' => ['width' => 1920],
        'social' => ['width' => 1200, 'height' => 630, 'crop' => true],
        'square' => ['width' => 1080, 'height' => 1080, 'crop' => true],
    ],
    'image_provider' => env('MEDIA_IMAGE_PROVIDER', 'mock'),
    'stock_provider' => env('MEDIA_STOCK_PROVIDER', 'mock'),
];
