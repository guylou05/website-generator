<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class GenerationSummaryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $revision = $this->relationLoaded('latestRevision') ? $this->latestRevision : null;
        $generation = $this->relationLoaded('generationRuns') ? $this->generationRuns->first() : null;

        if (! $revision) {
            return [
                'generation_status' => $generation?->status ?? 'not_generated',
                'latest_revision' => null,
                'page_count' => 0,
                'blueprint_status' => 'not_generated',
                'elementor_status' => 'not_ready',
                'deployment_ready' => false,
            ];
        }

        $pageCount = count($revision->blueprint['pages'] ?? []);
        $blueprintStatus = match ($revision->validation['valid'] ?? null) {
            true => 'valid',
            false => 'invalid',
            default => 'pending',
        };
        $documents = $revision->elementor_output['documents'] ?? [];
        $elementorStatus = ($revision->elementor_output['status'] ?? null) === 'ready'
            && $pageCount > 0
            && count($documents) === $pageCount
                ? 'ready'
                : 'not_ready';
        $generationStatus = $generation?->status ?? 'not_generated';

        return [
            'generation_status' => $generationStatus,
            'latest_revision' => [
                'id' => $revision->id,
                'revision_number' => $revision->revision_number,
                'status' => $revision->status,
            ],
            'page_count' => $pageCount,
            'blueprint_status' => $blueprintStatus,
            'elementor_status' => $elementorStatus,
            'deployment_ready' => $generationStatus === 'succeeded'
                && $blueprintStatus === 'valid'
                && $elementorStatus === 'ready',
        ];
    }
}
