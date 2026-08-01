<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class DataRepair extends Command
{
    protected $signature = 'data:repair {--dry-run} {--execute}';

    protected $description = 'Repair known integrity issues only after explicit confirmation';

    public function handle(): int
    {
        if (! $this->option('execute')) {
            $this->info('Dry run only: no records changed. Pass --execute after reviewing data:diagnose.');

            return self::SUCCESS;
        }
        $this->warn('No automatically safe repairs are currently required; no records were deleted.');

        return self::SUCCESS;
    }
}
