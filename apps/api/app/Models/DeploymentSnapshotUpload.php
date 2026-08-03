<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DeploymentSnapshotUpload extends Model
{
    public $incrementing = false;

    public $timestamps = false;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['manifest' => 'array', 'created_at' => 'datetime'];
    }
}
