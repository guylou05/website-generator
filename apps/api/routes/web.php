<?php

use Illuminate\Support\Facades\Route;

Route::get('/reset-password/{token}', fn (string $token) => redirect(rtrim(config('app.dashboard_url'), '/').'/reset-password?token='.urlencode($token).'&email='.urlencode((string) request('email'))))->name('password.reset');
