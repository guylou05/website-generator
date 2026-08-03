<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DeploymentSnapshotUpload extends Model
{
    public $incrementing = false;

    public const UPDATED_AT = 'updated_at';

    public const CREATED_AT = null;

    protected $guarded = [];

    public function chunks()
    {
        return $this->hasMany(DeploymentSnapshotUploadChunk::class, 'upload_id');
    }

    protected function casts(): array
    {
        return ['manifest' => 'array', 'created_at' => 'datetime', 'updated_at' => 'datetime'];
    }
}
