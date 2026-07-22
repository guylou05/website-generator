<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class GenerationRun extends Model
{
    use HasUuids;

    protected $fillable = ['project_id', 'provider', 'status', 'current_stage', 'progress', 'input', 'output', 'error', 'started_at', 'completed_at'];

    protected function casts(): array
    {
        return ['input' => 'array', 'output' => 'array', 'error' => 'array', 'started_at' => 'datetime', 'completed_at' => 'datetime'];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function events(): HasMany
    {
        return $this->hasMany(GenerationEvent::class);
    }
}
