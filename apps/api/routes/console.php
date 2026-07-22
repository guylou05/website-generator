<?php

use App\Models\Organization;
use App\Services\EntitlementService;
use App\Services\UsageService;
use Illuminate\Support\Facades\Schedule;

Schedule::command('jobs:recover-stale')->everyMinute()->withoutOverlapping();

Artisan::command('billing:inspect {organization}', function (EntitlementService $entitlements, UsageService $usage) {
    $organization = Organization::findOrFail($this->argument('organization'));
    $this->table(['Plan', 'Generations', 'Deployments'], [[$entitlements->currentPlan($organization), $usage->used($organization, 'generations'), $usage->used($organization, 'live_deployments')]]);
})->purpose('Inspect authoritative billing and usage for an organization');

Artisan::command('billing:credit {organization} {metric} {quantity} {idempotency_key}', function (UsageService $usage) {
    $organization = Organization::findOrFail($this->argument('organization'));
    $quantity = -abs((int) $this->argument('quantity'));
    $entry = $usage->record($organization, $this->argument('metric'), $quantity, 'support_credit', null, $this->argument('idempotency_key'));
    $this->info("Credit ledger entry {$entry->id} recorded.");
})->purpose('Apply an idempotent, append-only usage credit');
