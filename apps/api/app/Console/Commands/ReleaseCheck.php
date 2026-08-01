<?php

namespace App\Console\Commands;

use App\Models\GenerationRun;
use App\Support\EnvironmentValidator;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;

class ReleaseCheck extends Command
{
    protected $signature = 'app:release-check';

    protected $description = 'Run blocking production release readiness checks';

    public function handle(): int
    {
        $errors = app(EnvironmentValidator::class)->errors();
        $checks = ['environment' => ! $errors, 'mail' => ! app(EnvironmentValidator::class)->mailErrors(), 'storage' => true, 'openai' => ! app(EnvironmentValidator::class)->openAiErrors(), 'stripe' => ! app(EnvironmentValidator::class)->billingErrors(), 'queue' => config('queue.default') !== 'sync' || ! app()->environment('production'), 'worker' => (bool) GenerationRun::whereNotNull('heartbeat_at')->max('heartbeat_at'), 'scheduler' => (bool) Cache::get('scheduler:heartbeat')];
        foreach ($checks as $name => $ok) {
            $this->{$ok ? 'info' : 'error'}(($ok ? 'PASS ' : 'FAIL ').$name);
        }
        foreach ($errors as $error) {
            $this->error($error);
        }

return in_array(false, $checks, true) ? self::FAILURE : self::SUCCESS;
    }
}
