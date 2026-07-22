<?php

namespace Tests;

use App\Models\User;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Schema;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        if (Schema::hasTable('users') && $user = User::where('email', 'legacy-owner@localhost.invalid')->first()) {
            $this->actingAs($user);
        }
    }
}
