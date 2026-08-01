<?php

namespace App\Console\Commands;

use App\Support\EnvironmentValidator;
use Illuminate\Console\Command;

class BillingDiagnose extends Command
{
    protected $signature = 'billing:diagnose';

    protected $description = 'Validate Stripe billing configuration without creating charges';

    public function handle(): int
    {
        $errors = app(EnvironmentValidator::class)->billingErrors();
        if ($errors) {
            foreach ($errors as $error) {
                $this->error($error);
            }

            return self::FAILURE;
        }
        $this->info(config('billing.enabled') ? 'Stripe keys, webhook secret, and known prices are configured. No charge was created.' : 'Billing is disabled; free-plan fallback is active.');

        return self::SUCCESS;
    }
}
