<?php

namespace App\Console\Commands;

use App\Services\StaleJobRecoveryService;
use Illuminate\Console\Command;

class RecoverStaleJobs extends Command
{
    protected $signature = 'jobs:recover-stale {--dry-run : Report stale jobs without changing them} {--execute : Recover stale jobs}';

    protected $description = 'Recover jobs whose worker heartbeat expired';

    public function handle(StaleJobRecoveryService $recovery): int
    {
        $count = $recovery->countAll();
        if (! $this->option('execute')) {
            $this->info("Dry run: {$count} stale job(s) found; no records changed. Pass --execute to recover them.");

            return self::SUCCESS;
        }
        $recovery->recoverAll();

        return self::SUCCESS;
    }
}
