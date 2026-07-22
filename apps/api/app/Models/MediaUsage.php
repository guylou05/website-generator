<?php

namespace App\Models;

use App\Models\Concerns\TenantBound;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MediaUsage extends Model
{
    use HasUuids, TenantBound { TenantBound::resolveRouteBindingQuery insteadof HasUuids; }

    protected $fillable = ['organization_id', 'media_asset_id', 'project_id', 'website_revision_id', 'page_id', 'section_id', 'field_path', 'usage_type'];

    protected function casts(): array
    {
        return [];
    }

    public function revision(): BelongsTo
    {
        return $this->belongsTo(WebsiteRevision::class, 'website_revision_id');
    }
}
