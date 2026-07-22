<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class DeploymentEvent extends Model
{
    use HasUuids;

    public $timestamps = false;

    protected $fillable = ['event_uuid', 'stage', 'event_type', 'progress', 'message', 'metadata', 'created_at'];

    protected function casts(): array
    {
        return ['metadata' => 'array', 'created_at' => 'datetime'];
    }
}
