<?php

namespace App\Models;

use App\Models\Concerns\TenantBound;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class RevisionChange extends Model
{
    use HasUuids, TenantBound { TenantBound::resolveRouteBindingQuery insteadof HasUuids; }

    public $timestamps = false;

    protected $fillable = ['organization_id', 'website_revision_id', 'page_id', 'section_id', 'field_path', 'change_type', 'old_value', 'new_value', 'actor_type', 'actor_id', 'metadata', 'created_at'];

    protected function casts(): array
    {
        return ['old_value' => 'array', 'new_value' => 'array', 'metadata' => 'array', 'created_at' => 'datetime'];
    }
}
