<?php

namespace App\Models;

use App\Models\Concerns\TenantBound;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class BrandKit extends Model
{
    use HasUuids, TenantBound { TenantBound::resolveRouteBindingQuery insteadof HasUuids; }

    protected $fillable = ['organization_id', 'project_id', 'name', 'is_default', 'primary_logo_asset_id', 'secondary_logo_asset_id', 'favicon_asset_id', 'primary_color', 'secondary_color', 'accent_color', 'neutral_colors', 'heading_font', 'body_font', 'image_style', 'created_by'];

    protected function casts(): array
    {
        return ['is_default' => 'boolean', 'neutral_colors' => 'array', 'image_style' => 'array'];
    }
}
