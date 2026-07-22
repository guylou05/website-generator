<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class MediaRebuildUsage extends Command
{
    protected $signature = 'media:rebuild-usage {--organization=}';

    protected $description = 'Rebuild stable blueprint media usage rows';

    public function handle(): int
    {
        $this->warn('Usage rebuild is revision-service driven; revisions will be reconciled on their next validation.');

        return self::SUCCESS;
    }
}
