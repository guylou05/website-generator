<?php

namespace App\Models;

use App\Models\Concerns\TenantBound;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

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

    public function latestRevision(): HasOne
    {
        // Avoid latestOfMany/ofMany here: PostgreSQL cannot MAX the UUID
        // primary key Laravel uses as a tie-breaker. Revision numbers are unique
        // per project, so ordering the has-one relation is deterministic.
        return $this->hasOne(WebsiteRevision::class)->orderByDesc('revision_number');
    }

    public function mediaAssets(): HasMany
    {
        return $this->hasMany(MediaAsset::class);
    }
}
