<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class GenerationEventResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return ['id' => $this->id, 'stage' => $this->stage, 'event_type' => $this->event_type, 'progress' => $this->progress, 'message' => $this->message, 'metadata' => $this->metadata, 'created_at' => $this->created_at];
    }
}
