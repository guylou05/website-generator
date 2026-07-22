<?php

namespace App\Services;

use App\Models\Organization;
use App\Models\Subscription;
use App\Models\UsageLedger;
use Carbon\CarbonImmutable;

class UsageService
{
    public function period(Organization $org): array
    {
        $sub = Subscription::where('organization_id', $org->id)->whereIn('status', ['active', 'trialing', 'past_due'])->latest('current_period_end')->first();
        if ($sub?->current_period_start && $sub?->current_period_end) {
            return [$sub->current_period_start, $sub->current_period_end];
        } $now = CarbonImmutable::now(config('billing.timezone'));

        return [$now->startOfMonth()->utc(), $now->endOfMonth()->utc()];
    }

    public function used(Organization $org, string $metric): int
    {
        [$start,$end] = $this->period($org);

        return (int) UsageLedger::where('organization_id', $org->id)->where('metric', $metric)->whereBetween('occurred_at', [$start, $end])->sum('quantity');
    }

    public function record(Organization $org, string $metric, int $quantity, string $sourceType, ?string $sourceId, string $key, array $metadata = []): UsageLedger
    {
        [$start,$end] = $this->period($org);

        return UsageLedger::firstOrCreate(['idempotency_key' => $key], ['organization_id' => $org->id, 'metric' => $metric, 'quantity' => $quantity, 'source_type' => $sourceType, 'source_id' => $sourceId, 'occurred_at' => now(), 'billing_period_start' => $start, 'billing_period_end' => $end, 'metadata' => $metadata ?: null]);
    }
}
