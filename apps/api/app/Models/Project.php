<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Project extends Model
{
    use HasUuids;

    protected $fillable = ['name', 'slug', 'status', 'business_profile', 'brand_settings'];

    protected function casts(): array
    {
        return ['business_profile' => 'array', 'brand_settings' => 'array'];
    }

    public function generationRuns(): HasMany
    {
        return $this->hasMany(GenerationRun::class);
    }

    public function wordpressConnections(): HasMany
    {
        return $this->hasMany(WordPressConnection::class);
    }

    public function deployments(): HasMany
    {
        return $this->hasMany(Deployment::class);
    }
}
