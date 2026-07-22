<?php

namespace App\Models;

use App\Models\Concerns\TenantBound;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class MediaAsset extends Model
{
    use HasUuids, SoftDeletes, TenantBound { TenantBound::resolveRouteBindingQuery insteadof HasUuids; }

    protected $fillable = ['organization_id', 'project_id', 'uploaded_by', 'source_type', 'status', 'original_filename', 'display_name', 'description', 'alt_text', 'caption', 'mime_type', 'extension', 'size_bytes', 'width', 'height', 'aspect_ratio', 'dominant_color', 'storage_disk', 'storage_key', 'checksum_sha256', 'metadata', 'provider', 'provider_asset_id', 'provider_attribution', 'parent_asset_id'];

    protected function casts(): array
    {
        return ['metadata' => 'array', 'provider_attribution' => 'array'];
    }

    public function variants(): HasMany
    {
        return $this->hasMany(MediaVariant::class);
    }

    public function usages(): HasMany
    {
        return $this->hasMany(MediaUsage::class);
    }
}
