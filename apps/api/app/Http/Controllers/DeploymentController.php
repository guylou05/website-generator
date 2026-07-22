<?php

namespace App\Http\Controllers;

use App\Models\Deployment;
use App\Models\Project;
use App\Services\DeploymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DeploymentController extends Controller
{
    public function index(Project $project): JsonResponse
    {
        return response()->json(['data' => $project->deployments()->with('events')->latest()->get()]);
    }

    public function show(Deployment $deployment): JsonResponse
    {
        return response()->json(['data' => $deployment->load('events')]);
    }

    public function preview(Request $request, Project $project, DeploymentService $service): JsonResponse
    {
        return $this->create($request, $project, $service, true);
    }

    public function store(Request $request, Project $project, DeploymentService $service): JsonResponse
    {
        return $this->create($request, $project, $service, false);
    }

    private function create(Request $request, Project $project, DeploymentService $service, bool $dryRun): JsonResponse
    {
        $data = $request->validate(['generation_run_id' => 'required|uuid', 'wordpress_connection_id' => 'required|uuid']);
        $run = $project->generationRuns()->findOrFail($data['generation_run_id']);
        $connection = $project->wordpressConnections()->findOrFail($data['wordpress_connection_id']);
        $deployment = $project->deployments()->create(['generation_run_id' => $run->id, 'wordpress_connection_id' => $connection->id, 'dry_run' => $dryRun]);

        return response()->json(['data' => $service->execute($deployment)], 201);
    }

    public function retry(Deployment $deployment, DeploymentService $service): JsonResponse
    {
        if (! in_array($deployment->status, ['failed', 'cancelled'], true)) {
            return response()->json(['error' => ['code' => 'not_retryable', 'message' => 'Only failed or cancelled deployments can be retried.']], 409);
        } $copy = $deployment->replicate(['status', 'progress', 'current_stage', 'operations', 'result', 'error', 'started_at', 'completed_at']);
        $copy->status = 'pending';
        $copy->progress = 0;
        $copy->save();

        return response()->json(['data' => $service->execute($copy)], 201);
    }

    public function cancel(Deployment $deployment): JsonResponse
    {
        if (in_array($deployment->status, ['completed', 'failed'], true)) {
            return response()->json(['error' => ['code' => 'not_cancellable', 'message' => 'This deployment has already finished.']], 409);
        } $deployment->update(['status' => 'cancelled', 'completed_at' => now()]);
        $deployment->events()->create(['stage' => $deployment->current_stage ?? 'initialization', 'event_type' => 'deployment.cancelled', 'progress' => $deployment->progress, 'message' => 'Deployment cancelled.', 'created_at' => now()]);

        return response()->json(['data' => $deployment->fresh('events')]);
    }
}
