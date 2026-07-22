<?php

return ['default' => env('MAIL_MAILER', 'log'), 'mailers' => ['smtp' => ['transport' => 'smtp', 'host' => env('MAIL_HOST', 'mailpit'), 'port' => (int) env('MAIL_PORT', 1025), 'encryption' => null, 'username' => null, 'password' => null], 'log' => ['transport' => 'log', 'channel' => env('MAIL_LOG_CHANNEL')]], 'from' => ['address' => env('MAIL_FROM_ADDRESS', 'hello@sitefoundry.test'), 'name' => env('MAIL_FROM_NAME', 'SiteFoundry')]];
