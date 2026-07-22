<?php

namespace App\Models;

use App\Models\Concerns\TenantBound;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ImageGenerationJob extends Model
{
    use HasUuids, TenantBound { TenantBound::resolveRouteBindingQuery insteadof HasUuids; }

    protected $fillable = ['organization_id', 'project_id', 'website_revision_id', 'requested_by', 'status', 'provider', 'model', 'prompt', 'negative_prompt', 'style_preset', 'aspect_ratio', 'requested_count', 'generated_count', 'input_asset_id', 'target_page_id', 'target_section_id', 'target_field_path', 'error', 'queued_at', 'started_at', 'completed_at', 'canceled_at'];

    protected function casts(): array
    {
        return ['error' => 'array', 'queued_at' => 'datetime', 'started_at' => 'datetime', 'completed_at' => 'datetime', 'canceled_at' => 'datetime'];
    }

    public function results(): HasMany
    {
        return $this->hasMany(ImageGenerationResult::class);
    }
}
