<?php

namespace App\Models;

use App\Models\Concerns\TenantBound;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class StockAssetReference extends Model
{
    use HasUuids, TenantBound { TenantBound::resolveRouteBindingQuery insteadof HasUuids; }

    protected $fillable = ['organization_id', 'project_id', 'provider', 'provider_asset_id', 'thumbnail_url', 'preview_url', 'photographer_name', 'photographer_url', 'source_url', 'attribution_text', 'width', 'height', 'metadata', 'imported_media_asset_id'];

    protected function casts(): array
    {
        return ['metadata' => 'array'];
    }
}
