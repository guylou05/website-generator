<?php

namespace App\Services;

use App\Models\Organization;
use App\Models\OrganizationBillingProfile;
use App\Models\Subscription;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Stripe\StripeClient;

class SubscriptionService
{
    public function __construct(private PlanCatalog $catalog) {}

    private function stripe(): StripeClient
    {
        $key = config('billing.stripe.secret');
        if (! $key) {
            throw ValidationException::withMessages(['billing' => ['Stripe billing is not configured.']]);
        }

return new StripeClient($key);
    }

    public function customer(Organization $org): OrganizationBillingProfile
    {
        return DB::transaction(function () use ($org) {
            $p = OrganizationBillingProfile::where('organization_id', $org->id)->lockForUpdate()->firstOrCreate(['organization_id' => $org->id]);
            if (! $p->stripe_customer_id) {
                $c = $this->stripe()->customers->create(['name' => $org->name, 'metadata' => ['organization_id' => $org->id]], ['idempotency_key' => 'customer-'.$org->id]);
                $p->update(['stripe_customer_id' => $c->id]);
            }

return $p->fresh();
        });
    }

    public function checkout(Organization $org, string $plan, string $interval, string $success, string $cancel): array
    {
        $price = $this->catalog->price($plan, $interval);
        $customer = $this->customer($org);
        $s = $this->stripe()->checkout->sessions->create(['mode' => 'subscription', 'customer' => $customer->stripe_customer_id, 'line_items' => [['price' => $price, 'quantity' => 1]], 'success_url' => $success, 'cancel_url' => $cancel, 'allow_promotion_codes' => (bool) config('billing.stripe.promotion_codes'), 'automatic_tax' => ['enabled' => (bool) config('billing.stripe.automatic_tax')], 'client_reference_id' => $org->id, 'metadata' => ['organization_id' => $org->id, 'plan_key' => $plan], 'subscription_data' => ['metadata' => ['organization_id' => $org->id, 'plan_key' => $plan]]], ['idempotency_key' => 'checkout-'.$org->id.'-'.$plan.'-'.$interval.'-'.now()->format('YmdHi')]);

        return ['url' => $s->url, 'plan_key' => $plan, 'billing_interval' => $interval];
    }

    public function portal(Organization $org, string $return): array
    {
        $p = $this->customer($org);
        $args = ['customer' => $p->stripe_customer_id, 'return_url' => $return];
        if (config('billing.stripe.portal_configuration')) {
            $args['configuration'] = config('billing.stripe.portal_configuration');
        } $s = $this->stripe()->billingPortal->sessions->create($args);

        return ['url' => $s->url];
    }

    public function mutate(Organization $org, string $action, ?string $plan = null, ?string $interval = null): Subscription
    {
        $sub = Subscription::where('organization_id', $org->id)->latest()->firstOrFail();
        $stripe = $this->stripe();
        $remote = $stripe->subscriptions->retrieve($sub->stripe_subscription_id, []);
        if ($action === 'change') {
            $price = $this->catalog->price($plan, $interval);
            $stripe->subscriptions->update($sub->stripe_subscription_id, ['items' => [['id' => $remote->items->data[0]->id, 'price' => $price]], 'proration_behavior' => 'create_prorations', 'metadata' => ['organization_id' => $org->id, 'plan_key' => $plan]], ['idempotency_key' => 'change-'.$sub->id.'-'.$price]);
        } elseif ($action === 'cancel') {
            $stripe->subscriptions->update($sub->stripe_subscription_id, ['cancel_at_period_end' => true], ['idempotency_key' => 'cancel-'.$sub->id]);
        } else {
            $stripe->subscriptions->update($sub->stripe_subscription_id, ['cancel_at_period_end' => false], ['idempotency_key' => 'resume-'.$sub->id]);
        }

return $sub->fresh();
    }
}
