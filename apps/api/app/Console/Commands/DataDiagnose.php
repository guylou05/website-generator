<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class DataDiagnose extends Command
{
    protected $signature = 'data:diagnose';

    protected $description = 'Inspect database integrity without changing data';

    public function handle(): int
    {
        $orphans = DB::table('projects')->leftJoin('organizations', 'organizations.id', '=', 'projects.organization_id')->whereNull('organizations.id')->count();
        $this->line("orphan_projects: {$orphans}");

        return $orphans ? self::FAILURE : self::SUCCESS;
    }
}
