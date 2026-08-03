<?php

namespace App\Models;

use App\Models\Concerns\TenantBound;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Rollback extends Model
{
    use HasUuids, TenantBound { TenantBound::resolveRouteBindingQuery insteadof HasUuids; }

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['progress' => 'integer', 'result_summary' => 'array', 'error_details' => 'array', 'cancellation_requested_at' => 'datetime', 'started_at' => 'datetime', 'completed_at' => 'datetime', 'failed_at' => 'datetime', 'cancelled_at' => 'datetime'];
    }

    public function plan()
    {
        return $this->belongsTo(RollbackPlan::class, 'rollback_plan_id');
    }

    public function sourceDeployment()
    {
        return $this->belongsTo(Deployment::class, 'source_deployment_id');
    }

    public function events()
    {
        return $this->hasMany(RollbackEvent::class);
    }

    public function items()
    {
        return $this->hasMany(RollbackItem::class);
    }
}
