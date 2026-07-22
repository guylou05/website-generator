<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('organization_billing_profiles', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('organization_id')->unique()->constrained()->cascadeOnDelete();
            $t->string('stripe_customer_id')->nullable()->unique();
            $t->string('billing_email')->nullable();
            $t->string('billing_name')->nullable();
            $t->json('billing_address')->nullable();
            $t->json('tax_id_summary')->nullable();
            $t->timestamps();
        });
        Schema::create('subscriptions', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('organization_id')->index()->constrained()->cascadeOnDelete();
            $t->string('stripe_subscription_id')->unique();
            $t->string('stripe_customer_id');
            $t->string('plan_key');
            $t->string('stripe_price_id');
            $t->string('billing_interval');
            $t->string('status');
            $t->unsignedInteger('quantity')->default(1);
            foreach (['trial_ends_at', 'current_period_start', 'current_period_end', 'cancel_at', 'canceled_at', 'ended_at', 'grace_ends_at'] as $c) {
                $t->timestamp($c)->nullable();
            } $t->json('metadata')->nullable();
            $t->timestamps();
        });
        Schema::create('usage_ledgers', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('organization_id')->index()->constrained()->cascadeOnDelete();
            $t->string('metric')->index();
            $t->integer('quantity');
            $t->string('source_type');
            $t->uuid('source_id')->nullable();
            $t->string('idempotency_key')->unique();
            $t->timestamp('occurred_at');
            $t->timestamp('billing_period_start');
            $t->timestamp('billing_period_end');
            $t->json('metadata')->nullable();
            $t->timestamp('created_at')->useCurrent();
            $t->index(['organization_id', 'metric', 'billing_period_start', 'billing_period_end']);
        });
        Schema::create('stripe_webhook_events', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->string('stripe_event_id')->unique();
            $t->string('event_type');
            $t->string('api_version')->nullable();
            $t->string('payload_hash', 64);
            $t->string('status')->default('pending');
            $t->unsignedInteger('attempts')->default(0);
            $t->timestamp('processed_at')->nullable();
            $t->text('last_error')->nullable();
            $t->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stripe_webhook_events');
        Schema::dropIfExists('usage_ledgers');
        Schema::dropIfExists('subscriptions');
        Schema::dropIfExists('organization_billing_profiles');
    }
};
