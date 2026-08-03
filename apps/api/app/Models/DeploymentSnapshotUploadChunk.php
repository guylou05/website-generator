<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DeploymentSnapshotUploadChunk extends Model
{
    public $timestamps = false;

    protected $fillable = ['upload_id', 'sequence', 'checksum', 'data'];
}
