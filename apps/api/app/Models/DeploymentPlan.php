<?php

namespace App\Models;

use App\Models\Concerns\TenantBound;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DeploymentPlan extends Model
{
    use HasUuids, TenantBound { TenantBound::resolveRouteBindingQuery insteadof HasUuids; }

    protected $fillable = ['organization_id', 'project_id', 'website_revision_id', 'wordpress_connection_id', 'status', 'safety_status', 'snapshot', 'changes', 'statistics', 'warnings', 'estimated_seconds', 'created_by'];

    protected function casts(): array
    {
        return ['snapshot' => 'array', 'changes' => 'array', 'statistics' => 'array', 'warnings' => 'array', 'estimated_seconds' => 'integer'];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function websiteRevision(): BelongsTo
    {
        return $this->belongsTo(WebsiteRevision::class);
    }

    public function wordpressConnection(): BelongsTo
    {
        return $this->belongsTo(WordPressConnection::class);
    }
}
