<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProjectResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return ['id' => $this->id, 'name' => $this->name, 'slug' => $this->slug, 'status' => $this->status, 'business_profile' => $this->business_profile, 'brand_settings' => $this->brand_settings, 'created_at' => $this->created_at, 'updated_at' => $this->updated_at, 'generation_runs' => GenerationRunResource::collection($this->whenLoaded('generationRuns'))];
    }
}
