<?php

namespace App\Console\Commands;

use App\Models\GenerationRun;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class JobsDiagnose extends Command
{
    protected $signature = 'jobs:diagnose';

    protected $description = 'Report queue, worker, scheduler, and failed-job health';

    public function handle(): int
    {
        $this->table(['Check', 'Value'], [['queue', config('queue.default')], ['failed jobs', DB::table('failed_jobs')->count()], ['worker heartbeat', GenerationRun::whereNotNull('heartbeat_at')->max('heartbeat_at') ?? 'missing'], ['scheduler heartbeat', Cache::get('scheduler:heartbeat') ?? 'missing']]);

        return config('queue.default') === 'sync' && app()->environment('production') ? self::FAILURE : self::SUCCESS;
    }
}
