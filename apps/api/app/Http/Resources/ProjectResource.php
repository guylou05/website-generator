<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProjectResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $revision = $this->relationLoaded('latestRevision') ? $this->latestRevision : null;
        $run = $this->relationLoaded('generationRuns') ? $this->generationRuns->first() : null;
        $pageCount = count($revision?->blueprint['pages'] ?? []);
        $validationStatus = ! $revision ? 'not_generated' : (($revision->validation['valid'] ?? null) === true ? 'valid' : (($revision->validation['valid'] ?? null) === false ? 'invalid' : 'pending'));
        $documents = $revision?->elementor_output['documents'] ?? [];
        $renderStatus = ! $revision ? 'not_generated' : (($revision->elementor_output['status'] ?? null) === 'ready' && $pageCount > 0 && count($documents) === $pageCount ? 'ready' : (count($documents) > 0 ? 'partial' : 'pending'));
        $generationStatus = $run?->status ?? 'not_generated';
        $deploymentReady = $generationStatus === 'succeeded' && $validationStatus === 'valid' && $pageCount > 0 && $renderStatus === 'ready';

        return ['id' => $this->id, 'name' => $this->name, 'slug' => $this->slug, 'status' => $this->status, 'business_profile' => $this->business_profile, 'brand_settings' => $this->brand_settings, 'created_at' => $this->created_at, 'updated_at' => $this->updated_at, 'generation_runs' => GenerationRunResource::collection($this->whenLoaded('generationRuns')), 'summary' => ['generation' => ['status' => $generationStatus, 'completed_at' => $run?->completed_at], 'latest_revision' => $revision ? ['id' => $revision->id, 'page_count' => $pageCount, 'blueprint_status' => $validationStatus, 'elementor_status' => $renderStatus] : null, 'deployment_ready' => $deploymentReady]];
    }
}
