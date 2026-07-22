<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GenerationEvent extends Model
{
    use HasUuids;

    public const UPDATED_AT = null;

    protected $fillable = ['event_uuid', 'stage', 'event_type', 'progress', 'message', 'metadata'];

    protected function casts(): array
    {
        return ['metadata' => 'array'];
    }

    public function generationRun(): BelongsTo
    {
        return $this->belongsTo(GenerationRun::class);
    }
}
