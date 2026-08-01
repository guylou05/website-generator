<?php

namespace App\Jobs;

use App\Models\User;
use App\Notifications\WelcomeNotification;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class SendWelcomeEmail implements ShouldBeUnique, ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public function __construct(public string $userId) {}

    public function uniqueId(): string
    {
        return $this->userId;
    }

    public function handle(): void
    {
        $user = User::find($this->userId);
        if (! $user || $user->welcome_email_sent_at) {
            return;
        }
        $user->notify(new WelcomeNotification);
        $user->forceFill(['welcome_email_sent_at' => now()])->save();
    }

    public function failed(\Throwable $exception): void
    {
        Log::error('Welcome email delivery failed.', ['user_id' => $this->userId, 'exception' => $exception::class]);
    }
}
