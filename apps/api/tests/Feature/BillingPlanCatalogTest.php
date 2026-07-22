<?php

namespace Tests\Feature;

use App\Services\PlanCatalog;
use Tests\TestCase;

class BillingPlanCatalogTest extends TestCase
{
    public function test_internal_plan_entitlements_are_server_owned(): void
    {
        $catalog = app(PlanCatalog::class);

        $this->assertSame(['free', 'starter', 'pro', 'agency'], array_keys($catalog->all()));
        $this->assertSame(1, $catalog->plan('free')['entitlements']['generations']);
        $this->assertSame(['mock'], $catalog->plan('free')['entitlements']['providers']);
        $this->assertContains('openai', $catalog->plan('pro')['entitlements']['providers']);
    }

    public function test_public_catalog_never_exposes_stripe_price_ids(): void
    {
        config(['billing.plans.starter.prices.monthly' => 'price_private']);

        $json = json_encode(app(PlanCatalog::class)->publicPlans(), JSON_THROW_ON_ERROR);
        $this->assertStringNotContainsString('price_private', $json);
        $this->assertStringNotContainsString('prices', $json);
    }
}
