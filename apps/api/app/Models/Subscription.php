<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Subscription extends Model
{
    use HasUuids;

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['trial_ends_at' => 'datetime', 'current_period_start' => 'datetime', 'current_period_end' => 'datetime', 'cancel_at' => 'datetime', 'canceled_at' => 'datetime', 'ended_at' => 'datetime', 'grace_ends_at' => 'datetime', 'metadata' => 'array'];
    }
}
