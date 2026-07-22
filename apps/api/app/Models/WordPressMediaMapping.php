<?php

namespace App\Models;

use App\Models\Concerns\TenantBound;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class WordPressMediaMapping extends Model
{
    use HasUuids, TenantBound { TenantBound::resolveRouteBindingQuery insteadof HasUuids; }

    protected $fillable = ['organization_id', 'wordpress_connection_id', 'media_asset_id', 'media_variant_id', 'wordpress_attachment_id', 'wordpress_url', 'checksum_sha256', 'last_synced_at', 'metadata'];

    protected function casts(): array
    {
        return ['last_synced_at' => 'datetime', 'metadata' => 'array'];
    }
}
