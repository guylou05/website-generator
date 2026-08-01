<?php

return ['default' => env('MAIL_MAILER', 'log'), 'mailers' => ['smtp' => ['transport' => 'smtp', 'scheme' => env('MAIL_SCHEME'), 'host' => env('MAIL_HOST', 'mailpit'), 'port' => (int) env('MAIL_PORT', 1025), 'username' => env('MAIL_USERNAME'), 'password' => env('MAIL_PASSWORD'), 'timeout' => (int) env('MAIL_TIMEOUT', 10)], 'log' => ['transport' => 'log', 'channel' => env('MAIL_LOG_CHANNEL')]], 'from' => ['address' => env('MAIL_FROM_ADDRESS', 'noreply@example.com'), 'name' => env('MAIL_FROM_NAME', 'SiteFoundry')]];
