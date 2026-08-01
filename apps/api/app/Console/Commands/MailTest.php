<?php

namespace App\Console\Commands;

use App\Support\EnvironmentValidator;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;
use Throwable;

class MailTest extends Command
{
    protected $signature = 'mail:test {recipient}';

    protected $description = 'Validate mail configuration and send a safe test message';

    public function handle(): int
    {
        $recipient = (string) $this->argument('recipient');
        if (! filter_var($recipient, FILTER_VALIDATE_EMAIL)) {
            $this->error('Recipient is not a valid email address.');

            return self::FAILURE;
        }
        $errors = app(EnvironmentValidator::class)->mailErrors();
        if ($errors) {
            foreach ($errors as $error) {
                $this->error($error);
            }

            return self::FAILURE;
        }
        try {
            Mail::raw('This is a SiteFoundry mail configuration test. No action is required.', fn ($mail) => $mail->to($recipient)->subject('SiteFoundry mail test'));
        } catch (Throwable) {
            $this->error('Mail transport failed. Review configuration and logs; credentials were not displayed.');

            return self::FAILURE;
        }
        $this->info("Test message accepted for {$recipient} using ".config('mail.default').'.');

        return self::SUCCESS;
    }
}
