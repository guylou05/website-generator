<?php

namespace App\Models;

use App\Models\Concerns\TenantBound;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class RevisionProposal extends Model
{
    use HasUuids, TenantBound { TenantBound::resolveRouteBindingQuery insteadof HasUuids; }

    protected $fillable = ['organization_id', 'project_id', 'website_revision_id', 'job_type', 'target_path', 'status', 'input', 'proposed_value', 'error', 'provider', 'model', 'created_by', 'accepted_at', 'rejected_at'];

    protected function casts(): array
    {
        return ['input' => 'array', 'proposed_value' => 'array', 'error' => 'array', 'accepted_at' => 'datetime', 'rejected_at' => 'datetime'];
    }
}
