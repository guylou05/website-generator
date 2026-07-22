<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class GenerationRunResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return ['id' => $this->id, 'project_id' => $this->project_id, 'provider' => $this->provider, 'status' => $this->status, 'current_stage' => $this->current_stage, 'progress' => $this->progress, 'input' => $this->input, 'output' => $this->output, 'error' => $this->error, 'started_at' => $this->started_at, 'completed_at' => $this->completed_at, 'created_at' => $this->created_at, 'updated_at' => $this->updated_at, 'events' => GenerationEventResource::collection($this->whenLoaded('events'))];
    }
}
