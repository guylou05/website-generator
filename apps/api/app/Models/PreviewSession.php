<?php

namespace App\Models;

use App\Models\Concerns\TenantBound;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class PreviewSession extends Model
{
    use HasUuids, TenantBound { TenantBound::resolveRouteBindingQuery insteadof HasUuids; }

    public $timestamps = false;

    protected $fillable = ['organization_id', 'project_id', 'website_revision_id', 'token_hash', 'expires_at', 'revoked_at', 'created_by', 'created_at'];

    protected $hidden = ['token_hash'];

    protected function casts(): array
    {
        return ['expires_at' => 'datetime', 'revoked_at' => 'datetime', 'created_at' => 'datetime'];
    }
}
