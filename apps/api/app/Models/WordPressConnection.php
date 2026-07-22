<?php

namespace App\Models;

use App\Models\Concerns\TenantBound;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class WordPressConnection extends Model
{
    use HasUuids, TenantBound { TenantBound::resolveRouteBindingQuery insteadof HasUuids; }

    protected $table = 'wordpress_connections';

    protected $fillable = ['project_id', 'organization_id', 'site_url', 'username', 'encrypted_application_password', 'status', 'wordpress_version', 'elementor_version', 'connector_version', 'last_verified_at', 'last_error'];

    protected $hidden = ['encrypted_application_password'];

    protected function casts(): array
    {
        return ['encrypted_application_password' => 'encrypted', 'last_verified_at' => 'datetime', 'last_error' => 'array'];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function deployments(): HasMany
    {
        return $this->hasMany(Deployment::class);
    }
}
