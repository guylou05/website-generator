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

    protected $fillable = ['project_id', 'organization_id', 'deployment_plan_id', 'generation_run_id', 'website_revision_id', 'wordpress_connection_id', 'status', 'dry_run', 'progress', 'current_stage', 'operations', 'result', 'result_summary', 'error', 'error_details', 'options', 'warnings', 'connector_version', 'duration_ms', 'steps_completed', 'created_by', 'approval_checksum', 'idempotency_key', 'rollback_snapshot_id', 'queued_at', 'heartbeat_at', 'cancellation_requested_at', 'attempt', 'max_attempts', 'worker_id', 'started_at', 'completed_at', 'failed_at', 'cancelled_at'];

    protected function casts(): array
    {
        return ['dry_run' => 'boolean', 'operations' => 'array', 'result' => 'array', 'result_summary' => 'array', 'error' => 'array', 'error_details' => 'array', 'options' => 'array', 'warnings' => 'array', 'duration_ms' => 'integer', 'steps_completed' => 'integer', 'queued_at' => 'datetime', 'heartbeat_at' => 'datetime', 'cancellation_requested_at' => 'datetime', 'started_at' => 'datetime', 'completed_at' => 'datetime', 'failed_at' => 'datetime', 'cancelled_at' => 'datetime'];
    }

    public function events(): HasMany
    {
        return $this->hasMany(DeploymentEvent::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(DeploymentItem::class);
    }

    public function rollbacks(): HasMany
    {
        return $this->hasMany(Rollback::class, 'source_deployment_id');
    }

    public function deploymentPlan(): BelongsTo
    {
        return $this->belongsTo(DeploymentPlan::class);
    }

    public function rollbackSnapshot(): BelongsTo
    {
        return $this->belongsTo(DeploymentRollbackSnapshot::class, 'rollback_snapshot_id');
    }

    public function wordpressConnection(): BelongsTo
    {
        return $this->belongsTo(WordPressConnection::class, 'wordpress_connection_id');
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    /** @deprecated Use wordpressConnection() instead. */
    public function connection(): BelongsTo
    {
        return $this->wordpressConnection();
    }

    public function generationRun(): BelongsTo
    {
        return $this->belongsTo(GenerationRun::class);
    }

    public function websiteRevision(): BelongsTo
    {
        return $this->belongsTo(WebsiteRevision::class);
    }
}
