<?php

namespace App\Providers;

use App\Support\EnvironmentValidator;
use Illuminate\Support\ServiceProvider;
use RuntimeException;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void {}

    public function boot(EnvironmentValidator $validator): void
    {
        if (env('RAILWAY_ENVIRONMENT_NAME')) {
            config(['session.secure' => true]);
            // Separate Railway domains require cross-site cookies; proxy mode remains Lax.
            config(['session.same_site' => env('SESSION_SAME_SITE', 'none')]);
        }
        // Console boot happens during dependency installation before deployment
        // variables are injected; validate production HTTP startup instead.
        if (! $this->app->runningInConsole() && $this->app->environment('production') && ($errors = $validator->errors())) {
            throw new RuntimeException("Invalid deployment configuration:\n - ".implode("\n - ", $errors));
        }
    }
}
