<?php

namespace App\Services;

use App\Models\OrganizationBillingProfile;
use App\Models\StripeWebhookEvent;
use App\Models\Subscription;
use Carbon\Carbon;
use Stripe\Webhook;

class StripeWebhookService
{
    public function __construct(private PlanCatalog $catalog) {}

    public function handle(string $payload, string $signature): bool
    {
        $event = Webhook::constructEvent($payload, $signature, (string) config('billing.stripe.webhook_secret'));
        $row = StripeWebhookEvent::firstOrCreate(['stripe_event_id' => $event->id], ['event_type' => $event->type, 'api_version' => $event->api_version, 'payload_hash' => hash('sha256', $payload), 'status' => 'pending', 'attempts' => 0]);
        if ($row->status === 'processed') {
            return false;
        } $row->increment('attempts');
        try {
            $this->process($event);
            $row->update(['status' => 'processed', 'processed_at' => now(), 'last_error' => null]);

            return true;
        } catch (\Throwable $e) {
            $row->update(['status' => 'failed', 'last_error' => mb_substr($e->getMessage(), 0, 1000)]);
            throw $e;
        }
    }

    private function process(object $event): void
    {
        $o = $event->data->object;
        if (str_starts_with($event->type, 'customer.') && isset($o->id)) {
            $org = $o->metadata->organization_id ?? null;
            if ($org) {
                OrganizationBillingProfile::updateOrCreate(['organization_id' => $org], ['stripe_customer_id' => $o->id, 'billing_email' => $o->email ?? null, 'billing_name' => $o->name ?? null]);
            }

            return;
        } if (str_starts_with($event->type, 'customer.subscription.')) {
            $this->syncSubscription($o, $event->type === 'customer.subscription.deleted');
        } if ($event->type === 'checkout.session.completed' && isset($o->customer,$o->client_reference_id)) {
            OrganizationBillingProfile::updateOrCreate(['organization_id' => $o->client_reference_id], ['stripe_customer_id' => $o->customer]);
        } if ($event->type === 'invoice.payment_failed' && isset($o->subscription)) {
            Subscription::where('stripe_subscription_id', $o->subscription)->update(['status' => 'past_due', 'grace_ends_at' => now()->addDays(config('billing.grace_days'))]);
        }
    }

    private function syncSubscription(object $s, bool $deleted): void
    {
        $price = $s->items->data[0]->price ?? null;
        $map = $price ? $this->catalog->keyForPrice($price->id) : null;
        $org = $s->metadata->organization_id ?? OrganizationBillingProfile::where('stripe_customer_id', $s->customer)->value('organization_id');
        if (! $org || ! $map) {
            return;
        } Subscription::updateOrCreate(['stripe_subscription_id' => $s->id], ['organization_id' => $org, 'stripe_customer_id' => $s->customer, 'plan_key' => $map[0], 'stripe_price_id' => $price->id, 'billing_interval' => $map[1], 'status' => $deleted ? 'canceled' : $s->status, 'quantity' => $s->items->data[0]->quantity ?? 1, 'trial_ends_at' => $this->date($s->trial_end ?? null), 'current_period_start' => $this->date($s->current_period_start ?? null), 'current_period_end' => $this->date($s->current_period_end ?? null), 'cancel_at' => $this->date($s->cancel_at ?? null), 'canceled_at' => $this->date($s->canceled_at ?? null), 'ended_at' => $this->date($s->ended_at ?? null), 'grace_ends_at' => $s->status === 'past_due' ? now()->addDays(config('billing.grace_days')) : null, 'metadata' => ['cancel_at_period_end' => (bool) ($s->cancel_at_period_end ?? false)]]);
    }

    private function date(?int $timestamp): ?Carbon
    {
        return $timestamp ? Carbon::createFromTimestamp($timestamp) : null;
    }
}
