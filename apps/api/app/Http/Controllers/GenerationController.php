<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreGenerationRequest;
use App\Http\Resources\GenerationRunResource;
use App\Models\GenerationRun;
use App\Models\Project;
use App\Services\GenerationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class GenerationController extends Controller
{
    public function store(StoreGenerationRequest $request, Project $project, GenerationService $service): JsonResponse
    {
        $run = $project->generationRuns()->create(['provider' => $request->validated('provider', config('services.ai.provider', env('AI_PROVIDER', 'mock'))), 'status' => 'pending', 'progress' => 0, 'input' => $request->validated('input')]);

        return response()->json(['data' => (new GenerationRunResource($service->execute($run)))->resolve()], 201);
    }

    public function index(Project $project): AnonymousResourceCollection
    {
        return GenerationRunResource::collection($project->generationRuns()->with('events')->latest()->get());
    }

    public function show(GenerationRun $generationRun): GenerationRunResource
    {
        return new GenerationRunResource($generationRun->load('events'));
    }

    public function retry(GenerationRun $generationRun, GenerationService $service): GenerationRunResource|JsonResponse
    {
        if (! in_array($generationRun->status, ['failed', 'cancelled'], true)) {
            return response()->json(['error' => ['code' => 'invalid_state', 'message' => 'Only failed or cancelled generations can be retried.']], 409);
        }
        $retry = $generationRun->project->generationRuns()->create(['provider' => $generationRun->provider, 'status' => 'pending', 'progress' => 0, 'input' => $generationRun->input]);

        return new GenerationRunResource($service->execute($retry));
    }

    public function cancel(GenerationRun $generationRun): GenerationRunResource|JsonResponse
    {
        if (in_array($generationRun->status, ['completed', 'failed', 'cancelled'], true)) {
            return response()->json(['error' => ['code' => 'invalid_state', 'message' => 'This generation can no longer be cancelled.']], 409);
        }
        $generationRun->update(['status' => 'cancelled', 'current_stage' => null, 'completed_at' => now()]);
        $generationRun->events()->create(['stage' => 'system', 'event_type' => 'run.cancelled', 'progress' => $generationRun->progress, 'message' => 'Generation cancelled']);
        $generationRun->project()->update(['status' => 'cancelled']);

        return new GenerationRunResource($generationRun->fresh('events'));
    }
}
