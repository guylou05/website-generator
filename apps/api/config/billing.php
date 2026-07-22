<?php

return [
    'grace_days' => (int) env('BILLING_GRACE_PERIOD_DAYS', 7),
    'timezone' => env('BILLING_USAGE_TIMEZONE', 'UTC'),
    'enforcement' => env('BILLING_ENFORCEMENT_ENABLED', true),
    'dashboard_origins' => array_values(array_filter(array_map('trim', explode(',', env('DASHBOARD_URL', 'http://localhost:3000'))))),
    'stripe' => [
        'secret' => env('STRIPE_SECRET_KEY'), 'publishable' => env('STRIPE_PUBLISHABLE_KEY'),
        'webhook_secret' => env('STRIPE_WEBHOOK_SECRET'), 'portal_configuration' => env('STRIPE_PORTAL_CONFIGURATION_ID'),
        'promotion_codes' => env('STRIPE_ENABLE_PROMOTION_CODES', false), 'automatic_tax' => env('STRIPE_ENABLE_AUTOMATIC_TAX', false),
    ],
    'plans' => [
        'free' => ['name' => 'Free', 'prices' => ['monthly' => null, 'yearly' => null], 'entitlements' => ['members' => 1, 'projects' => 1, 'generations' => 1, 'live_deployments' => 0, 'wordpress_connections' => 0, 'invitations' => false, 'providers' => ['mock']]],
        'starter' => ['name' => 'Starter', 'prices' => ['monthly' => env('STRIPE_PRICE_STARTER_MONTHLY'), 'yearly' => env('STRIPE_PRICE_STARTER_YEARLY')], 'entitlements' => ['members' => 3, 'projects' => 5, 'generations' => 10, 'live_deployments' => 5, 'wordpress_connections' => 3, 'invitations' => true, 'providers' => ['mock', 'openai']]],
        'pro' => ['name' => 'Pro', 'recommended' => true, 'prices' => ['monthly' => env('STRIPE_PRICE_PRO_MONTHLY'), 'yearly' => env('STRIPE_PRICE_PRO_YEARLY')], 'entitlements' => ['members' => 10, 'projects' => 25, 'generations' => 50, 'live_deployments' => 25, 'wordpress_connections' => 15, 'invitations' => true, 'providers' => ['mock', 'openai']]],
        'agency' => ['name' => 'Agency', 'prices' => ['monthly' => env('STRIPE_PRICE_AGENCY_MONTHLY'), 'yearly' => env('STRIPE_PRICE_AGENCY_YEARLY')], 'entitlements' => ['members' => 50, 'projects' => 100, 'generations' => 250, 'live_deployments' => 150, 'wordpress_connections' => 50, 'invitations' => true, 'providers' => ['mock', 'openai']]],
    ],
];
