<?php

namespace App\Models;

use App\Models\Concerns\TenantBound;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Deployment extends Model
{
    use HasUuids, TenantBound { TenantBound::resolveRouteBindingQuery insteadof HasUuids; }

    protected $fillable = ['project_id', 'organization_id', 'generation_run_id', 'wordpress_connection_id', 'status', 'dry_run', 'progress', 'current_stage', 'operations', 'result', 'error', 'queued_at', 'heartbeat_at', 'cancellation_requested_at', 'attempt', 'max_attempts', 'worker_id', 'started_at', 'completed_at'];

    protected function casts(): array
    {
        return ['dry_run' => 'boolean', 'operations' => 'array', 'result' => 'array', 'error' => 'array', 'queued_at' => 'datetime', 'heartbeat_at' => 'datetime', 'cancellation_requested_at' => 'datetime', 'started_at' => 'datetime', 'completed_at' => 'datetime'];
    }

    public function events(): HasMany
    {
        return $this->hasMany(DeploymentEvent::class);
    }

    public function connection(): BelongsTo
    {
        return $this->belongsTo(WordPressConnection::class, 'wordpress_connection_id');
    }

    public function generationRun(): BelongsTo
    {
        return $this->belongsTo(GenerationRun::class);
    }
}
