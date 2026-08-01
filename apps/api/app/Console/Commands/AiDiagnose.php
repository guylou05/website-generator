<?php

namespace App\Console\Commands;

use App\Support\EnvironmentValidator;
use Illuminate\Console\Command;

class AiDiagnose extends Command
{
    protected $signature = 'ai:diagnose';

    protected $description = 'Validate the configured AI provider without generating a website';

    public function handle(): int
    {
        $errors = app(EnvironmentValidator::class)->openAiErrors();
        if ($errors) {
            foreach ($errors as $error) {
                $this->error($error);
            }

            return self::FAILURE;
        }
        $this->info('AI provider configuration is ready. No billable request was made.');

        return self::SUCCESS;
    }
}
