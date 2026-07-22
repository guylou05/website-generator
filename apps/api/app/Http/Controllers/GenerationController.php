<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreGenerationRequest;
use App\Http\Resources\GenerationRunResource;
use App\Jobs\GenerateWebsite;
use App\Models\GenerationRun;
use App\Models\Organization;
use App\Models\Project;
use App\Services\EntitlementService;
use App\Services\UsageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

class GenerationController extends Controller
{
    public function store(StoreGenerationRequest $request, Project $project, EntitlementService $entitlements, UsageService $usage): JsonResponse
    {
        $organization = Organization::findOrFail($project->organization_id);
        $provider = $request->validated('provider', env('AI_PROVIDER', 'mock'));
        if (config('billing.enforcement') && ! $entitlements->canStartGeneration($organization, $provider)) {
            return response()->json(['error' => $entitlements->denial($organization, 'generations') + ['provider' => $provider]], 402);
        }
        $run = DB::transaction(function () use ($project, $provider, $request, $usage, $organization, $entitlements) {
            Organization::whereKey($organization->id)->lockForUpdate()->first();
            if (config('billing.enforcement') && ! $entitlements->canStartGeneration($organization, $provider)) {
                return null;
            }
            $run = $project->generationRuns()->create(['organization_id' => $project->organization_id, 'provider' => $provider, 'status' => 'queued', 'progress' => 0, 'input' => $request->validated('input'), 'queued_at' => now()]);
            $usage->record($organization, 'generations', 1, 'generation_run', $run->id, 'generation-started-'.$run->id);

            return $run;
        });
        if (! $run) {
            return response()->json(['error' => $entitlements->denial($organization, 'generations')], 402);
        }
        $run->events()->create(['stage' => 'system', 'event_type' => 'run.queued', 'progress' => 0, 'message' => 'Generation queued']);
        GenerateWebsite::dispatch($run->id);

        return response()->json(['data' => (new GenerationRunResource($run->fresh('events')))->resolve()], 202);
    }

    public function index(Project $project): AnonymousResourceCollection
    {
        return GenerationRunResource::collection($project->generationRuns()->with('events')->latest()->get());
    }

    public function show(GenerationRun $generationRun): GenerationRunResource
    {
        return new GenerationRunResource($generationRun->load('events'));
    }

    public function retry(GenerationRun $generationRun): JsonResponse
    {
        if (! in_array($generationRun->status, ['failed', 'cancelled', 'stale'], true)) {
            return response()->json(['error' => ['code' => 'invalid_state', 'message' => 'Only failed, cancelled, or stale generations can be retried.']], 409);
        }
        $retry = $generationRun->project->generationRuns()->create(['organization_id' => $generationRun->organization_id, 'provider' => $generationRun->provider, 'status' => 'queued', 'progress' => 0, 'input' => $generationRun->input, 'queued_at' => now(), 'attempt' => $generationRun->attempt + 1, 'max_attempts' => $generationRun->max_attempts]);
        GenerateWebsite::dispatch($retry->id);

        return response()->json(['data' => (new GenerationRunResource($retry))->resolve()], 202);
    }

    public function cancel(GenerationRun $generationRun): GenerationRunResource|JsonResponse
    {
        if (! in_array($generationRun->status, ['queued', 'running'], true)) {
            return response()->json(['error' => ['code' => 'invalid_state', 'message' => 'This generation can no longer be cancelled.']], 409);
        }
        $generationRun->update(['status' => 'cancelling', 'cancellation_requested_at' => now()]);
        $generationRun->events()->create(['stage' => 'system', 'event_type' => 'run.cancelling', 'progress' => $generationRun->progress, 'message' => 'Cancellation requested']);

        return new GenerationRunResource($generationRun->fresh('events'));
    }
}
