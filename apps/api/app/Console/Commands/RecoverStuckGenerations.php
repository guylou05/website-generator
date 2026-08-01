<?php

namespace App\Console\Commands;

use App\Services\StaleJobRecoveryService;
use Illuminate\Console\Command;

class RecoverStuckGenerations extends Command
{
    protected $signature = 'generations:recover-stuck {--dry-run : Report stuck generations without changing them} {--execute : Recover stuck generations}';

    protected $description = 'Safely detect or recover generation runs whose pickup or heartbeat expired';

    public function handle(StaleJobRecoveryService $recovery): int
    {
        if ($this->option('dry-run') && $this->option('execute')) {
            $this->error('Choose either --dry-run or --execute.');

            return self::INVALID;
        }

        $count = $recovery->countGenerations();
        if (! $this->option('execute')) {
            $this->info("Dry run: {$count} stuck generation(s) found; no records changed. Pass --execute to recover them.");

            return self::SUCCESS;
        }

        $recovery->recoverGenerations();
        $this->info("Recovered {$count} stuck generation(s).");

        return self::SUCCESS;
    }
}
