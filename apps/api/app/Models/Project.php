<?php

namespace App\Models;

use App\Models\Concerns\TenantBound;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Project extends Model
{
    use HasUuids, TenantBound { TenantBound::resolveRouteBindingQuery insteadof HasUuids; }

    protected $fillable = ['name', 'slug', 'status', 'business_profile', 'brand_settings', 'organization_id', 'approved_revision_id'];

    protected function casts(): array
    {
        return ['business_profile' => 'array', 'brand_settings' => 'array'];
    }

    public function generationRuns(): HasMany
    {
        return $this->hasMany(GenerationRun::class);
    }

    public function wordpressConnections(): HasMany
    {
        return $this->hasMany(WordPressConnection::class);
    }

    public function deployments(): HasMany
    {
        return $this->hasMany(Deployment::class);
    }

    public function websiteRevisions(): HasMany
    {
        return $this->hasMany(WebsiteRevision::class);
    }

    public function approvedRevision(): BelongsTo
    {
        return $this->belongsTo(WebsiteRevision::class, 'approved_revision_id');
    }
}
