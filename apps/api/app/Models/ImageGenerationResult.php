<?php

namespace App\Models;

use App\Models\Concerns\TenantBound;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class ImageGenerationResult extends Model
{
    use HasUuids, TenantBound { TenantBound::resolveRouteBindingQuery insteadof HasUuids; }

    protected $fillable = ['organization_id', 'image_generation_job_id', 'media_asset_id', 'position', 'provider_metadata'];

    protected function casts(): array
    {
        return ['provider_metadata' => 'array'];
    }
}
