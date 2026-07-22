<?php

namespace App\Models;

use App\Models\Concerns\TenantBound;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class WebsiteRevision extends Model
{
    use HasUuids, TenantBound { TenantBound::resolveRouteBindingQuery insteadof HasUuids; }

    protected $fillable = ['organization_id', 'project_id', 'generation_run_id', 'parent_revision_id', 'revision_number', 'status', 'source', 'blueprint', 'elementor_output', 'validation', 'change_summary', 'created_by', 'approved_by', 'approved_at'];

    protected function casts(): array
    {
        return ['blueprint' => 'array', 'elementor_output' => 'array', 'validation' => 'array', 'change_summary' => 'array', 'approved_at' => 'datetime'];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function changes(): HasMany
    {
        return $this->hasMany(RevisionChange::class);
    }
}
