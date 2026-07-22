<?php

namespace App\Http\Controllers;

use App\Jobs\DeployWebsite;
use App\Models\Deployment;
use App\Models\Organization;
use App\Models\Project;
use App\Services\EntitlementService;
use App\Services\UsageService;
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
        $entitlements = app(EntitlementService::class);
        $usage = app(UsageService::class);
        $organization = Organization::findOrFail($project->organization_id);
        if (! $dryRun && config('billing.enforcement') && ! $entitlements->canStartLiveDeployment($organization)) {
            return response()->json(['error' => $entitlements->denial($organization, 'live_deployments')], 402);
        }
        $data = $request->validate(['wordpress_connection_id' => 'required|uuid']);
        $revision = $project->approvedRevision;
        if (! $revision || $revision->status !== 'approved') {
            return response()->json(['error' => ['code' => 'approved_revision_required', 'message' => 'Approve a rendered website revision before deployment.']], 409);
        }
        $run = $revision->generation_run_id ? $project->generationRuns()->findOrFail($revision->generation_run_id) : $project->generationRuns()->whereIn('status', ['succeeded', 'completed'])->latest()->firstOrFail();
        $connection = $project->wordpressConnections()->findOrFail($data['wordpress_connection_id']);
        if (! in_array($run->status, ['succeeded', 'completed'], true)) {
            return response()->json(['error' => ['code' => 'generation_not_ready', 'message' => 'A successful generation is required.']], 409);
        }
        if (! $dryRun && Deployment::where('project_id', $project->id)->where('dry_run', false)->whereIn('status', ['queued', 'running', 'cancelling'])->exists()) {
            return response()->json(['error' => ['code' => 'deployment_active', 'message' => 'A live deployment is already active.']], 409);
        }
        if (! $dryRun && ! Deployment::where(['project_id' => $project->id, 'website_revision_id' => $revision->id, 'wordpress_connection_id' => $connection->id, 'dry_run' => true, 'status' => 'succeeded'])->exists()) {
            return response()->json(['error' => ['code' => 'preview_required', 'message' => 'Run a successful deployment preview first.']], 409);
        }
        $deployment = $project->deployments()->create(['organization_id' => $project->organization_id, 'generation_run_id' => $run->id, 'website_revision_id' => $revision->id, 'wordpress_connection_id' => $connection->id, 'dry_run' => $dryRun, 'status' => 'queued', 'progress' => 0, 'queued_at' => now()]);
        $usage->record($organization, $dryRun ? 'deployment_preview_started' : 'live_deployments', 1, 'deployment', $deployment->id, 'deployment-started-'.$deployment->id);
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
