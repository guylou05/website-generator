<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class GenerationRun extends Model
{
    use HasUuids;

    protected $fillable = ['project_id', 'provider', 'status', 'current_stage', 'progress', 'input', 'output', 'error', 'queued_at', 'heartbeat_at', 'cancellation_requested_at', 'attempt', 'max_attempts', 'worker_id', 'started_at', 'completed_at'];

    protected function casts(): array
    {
        return ['input' => 'array', 'output' => 'array', 'error' => 'array', 'queued_at' => 'datetime', 'heartbeat_at' => 'datetime', 'cancellation_requested_at' => 'datetime', 'started_at' => 'datetime', 'completed_at' => 'datetime'];
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
