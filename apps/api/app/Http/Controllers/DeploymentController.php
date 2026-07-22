<?php

namespace App\Http\Controllers;

use App\Jobs\DeployWebsite;
use App\Models\Deployment;
use App\Models\Project;
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

    public function preview(Request $request, Project $project): JsonResponse
    {
        return $this->create($request, $project, true);
    }

    public function store(Request $request, Project $project): JsonResponse
    {
        return $this->create($request, $project, false);
    }

    private function create(Request $request, Project $project, bool $dryRun): JsonResponse
    {
        $data = $request->validate(['generation_run_id' => 'required|uuid', 'wordpress_connection_id' => 'required|uuid']);
        $run = $project->generationRuns()->findOrFail($data['generation_run_id']);
        $connection = $project->wordpressConnections()->findOrFail($data['wordpress_connection_id']);
        if (! in_array($run->status, ['succeeded', 'completed'], true)) {
            return response()->json(['error' => ['code' => 'generation_not_ready', 'message' => 'A successful generation is required.']], 409);
        }
        if (! $dryRun && Deployment::where('project_id', $project->id)->where('dry_run', false)->whereIn('status', ['queued', 'running', 'cancelling'])->exists()) {
            return response()->json(['error' => ['code' => 'deployment_active', 'message' => 'A live deployment is already active.']], 409);
        }
        if (! $dryRun && ! Deployment::where(['project_id' => $project->id, 'generation_run_id' => $run->id, 'wordpress_connection_id' => $connection->id, 'dry_run' => true, 'status' => 'succeeded'])->exists()) {
            return response()->json(['error' => ['code' => 'preview_required', 'message' => 'Run a successful deployment preview first.']], 409);
        }
        $deployment = $project->deployments()->create(['organization_id' => $project->organization_id, 'generation_run_id' => $run->id, 'wordpress_connection_id' => $connection->id, 'dry_run' => $dryRun, 'status' => 'queued', 'progress' => 0, 'queued_at' => now()]);
        $deployment->events()->create(['stage' => 'system', 'event_type' => 'deployment.queued', 'progress' => 0, 'message' => 'Deployment queued.', 'created_at' => now()]);
        DeployWebsite::dispatch($deployment->id);

        return response()->json(['data' => $deployment->fresh('events')], 202);
    }

    public function retry(Deployment $deployment): JsonResponse
    {
        if (! in_array($deployment->status, ['failed', 'cancelled', 'stale'], true)) {
            return response()->json(['error' => ['code' => 'not_retryable', 'message' => 'Deployment is not retryable.']], 409);
        }
        $copy = $deployment->replicate(['status', 'progress', 'current_stage', 'operations', 'result', 'error', 'queued_at', 'heartbeat_at', 'worker_id', 'started_at', 'completed_at']);
        $copy->fill(['status' => 'queued', 'progress' => 0, 'queued_at' => now(), 'attempt' => $deployment->attempt + 1]);
        $copy->save();
        DeployWebsite::dispatch($copy->id);

        return response()->json(['data' => $copy], 202);
    }

    public function cancel(Deployment $deployment): JsonResponse
    {
        if (! in_array($deployment->status, ['queued', 'running'], true)) {
            return response()->json(['error' => ['code' => 'not_cancellable', 'message' => 'This deployment cannot be cancelled.']], 409);
        }
        $deployment->update(['status' => 'cancelling', 'cancellation_requested_at' => now()]);
        $deployment->events()->create(['stage' => $deployment->current_stage ?? 'system', 'event_type' => 'deployment.cancelling', 'progress' => $deployment->progress, 'message' => 'Cancellation requested.', 'created_at' => now()]);

        return response()->json(['data' => $deployment->fresh('events')]);
    }
}
