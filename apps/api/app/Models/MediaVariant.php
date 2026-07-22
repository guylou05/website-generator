<?php

namespace App\Models;

use App\Models\Concerns\TenantBound;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class MediaVariant extends Model
{
    use HasUuids, TenantBound { TenantBound::resolveRouteBindingQuery insteadof HasUuids; }

    protected $fillable = ['organization_id', 'media_asset_id', 'variant_key', 'mime_type', 'extension', 'size_bytes', 'width', 'height', 'storage_disk', 'storage_key', 'checksum_sha256', 'processing_metadata'];

    protected function casts(): array
    {
        return ['processing_metadata' => 'array'];
    }
}
