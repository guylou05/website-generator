<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class UsageLedger extends Model
{
    use HasUuids;

    public $timestamps = false;

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['occurred_at' => 'datetime', 'billing_period_start' => 'datetime', 'billing_period_end' => 'datetime', 'metadata' => 'array', 'created_at' => 'datetime'];
    }
}
