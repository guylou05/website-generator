<?php

namespace App\Models;

use App\Models\Concerns\TenantBound;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class RollbackPlan extends Model
{
    use HasUuids, TenantBound { TenantBound::resolveRouteBindingQuery insteadof HasUuids; }

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['resources' => 'array', 'expected_remote_state' => 'array', 'warnings' => 'array', 'conflicts' => 'array', 'options' => 'array', 'approved_at' => 'datetime'];
    }

    public function sourceDeployment()
    {
        return $this->belongsTo(Deployment::class, 'source_deployment_id');
    }

    public function snapshot()
    {
        return $this->belongsTo(DeploymentRollbackSnapshot::class, 'rollback_snapshot_id');
    }

    public function rollback()
    {
        return $this->hasOne(Rollback::class);
    }
}
