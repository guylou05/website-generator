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
        'free' => ['name' => 'Free', 'prices' => ['monthly' => null, 'yearly' => null], 'entitlements' => ['members' => 1, 'projects' => 1, 'generations' => 1, 'live_deployments' => 0, 'wordpress_connections' => 0, 'invitations' => false, 'providers' => ['mock'], 'media_storage_bytes' => 104857600, 'media_asset_count' => 25, 'monthly_ai_images' => 0, 'stock_imports_per_month' => 3, 'max_upload_bytes' => 5242880, 'max_image_pixels' => 40000000, 'advanced_image_transformations' => false, 'background_removal' => false, 'organization_brand_kits' => 1]],
        'starter' => ['name' => 'Starter', 'prices' => ['monthly' => env('STRIPE_PRICE_STARTER_MONTHLY'), 'yearly' => env('STRIPE_PRICE_STARTER_YEARLY')], 'entitlements' => ['members' => 3, 'projects' => 5, 'generations' => 10, 'live_deployments' => 5, 'wordpress_connections' => 3, 'invitations' => true, 'providers' => ['mock', 'openai'], 'media_storage_bytes' => 2147483648, 'media_asset_count' => 500, 'monthly_ai_images' => 20, 'stock_imports_per_month' => 50, 'max_upload_bytes' => 15728640, 'max_image_pixels' => 60000000, 'advanced_image_transformations' => false, 'background_removal' => false, 'organization_brand_kits' => 3]],
        'pro' => ['name' => 'Pro', 'recommended' => true, 'prices' => ['monthly' => env('STRIPE_PRICE_PRO_MONTHLY'), 'yearly' => env('STRIPE_PRICE_PRO_YEARLY')], 'entitlements' => ['members' => 10, 'projects' => 25, 'generations' => 50, 'live_deployments' => 25, 'wordpress_connections' => 15, 'invitations' => true, 'providers' => ['mock', 'openai'], 'media_storage_bytes' => 10737418240, 'media_asset_count' => 5000, 'monthly_ai_images' => 100, 'stock_imports_per_month' => 250, 'max_upload_bytes' => 26214400, 'max_image_pixels' => 100000000, 'advanced_image_transformations' => true, 'background_removal' => false, 'organization_brand_kits' => 20]],
        'agency' => ['name' => 'Agency', 'prices' => ['monthly' => env('STRIPE_PRICE_AGENCY_MONTHLY'), 'yearly' => env('STRIPE_PRICE_AGENCY_YEARLY')], 'entitlements' => ['members' => 50, 'projects' => 100, 'generations' => 250, 'live_deployments' => 150, 'wordpress_connections' => 50, 'invitations' => true, 'providers' => ['mock', 'openai'], 'media_storage_bytes' => 53687091200, 'media_asset_count' => 25000, 'monthly_ai_images' => 500, 'stock_imports_per_month' => 1000, 'max_upload_bytes' => 52428800, 'max_image_pixels' => 150000000, 'advanced_image_transformations' => true, 'background_removal' => true, 'organization_brand_kits' => 100]],
    ],
];
