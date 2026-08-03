<?php

namespace App\Http\Controllers;

use App\Models\Deployment;
use App\Models\DeploymentPlan;
use App\Models\Organization;
use App\Models\Project;
use App\Models\WordPressConnection;
use App\Services\ApprovedDeploymentService;
use App\Services\DeploymentService;
use App\Services\EntitlementService;
use App\Services\JobTransport;
use App\Services\UsageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class DeploymentController extends Controller
{
    public function deploy(Request $request, DeploymentPlan $plan, ApprovedDeploymentService $service): JsonResponse
    {
        $deployment = $service->start($plan, $request);

        return response()->json(['data' => ['deployment_id' => $deployment->id, 'status' => $deployment->status, 'progress_url' => '/api/deployments/'.$deployment->id]], 202);
    }

    public function index(Project $project): JsonResponse
    {
        return response()->json(['data' => $project->deployments()->with(['events', 'wordpressConnection:id,name,site_url', 'websiteRevision:id,revision_number'])->latest()->limit(10)->get()->map(fn (Deployment $deployment) => $this->safeDeployment($deployment))]);
    }

    public function show(Deployment $deployment): JsonResponse
    {
        $deployment->load(['events', 'items', 'project:id,name', 'deploymentPlan', 'wordpressConnection:id,name,site_url,status', 'websiteRevision:id,revision_number']);

        $data = $this->safeDeployment($deployment);
        [$data['retry_allowed'], $data['retry_reason']] = $this->retryEligibility($deployment);

        return response()->json(['data' => $data]);
    }

    /** Execute a queued/failed approved deployment. Completed executions are idempotent. */
    public function execute(Deployment $deployment, DeploymentService $service): JsonResponse
    {
        if (! $deployment->deployment_plan_id) {
            return response()->json(['error' => ['code' => 'approved_plan_required', 'message' => 'This deployment was not created from an approved plan.']], 409);
        }
        if ($deployment->status === 'running') {
            return response()->json(['error' => ['code' => 'deployment_locked', 'message' => 'Deployment is already running.']], 409);
        }

        return response()->json(['data' => $service->execute($deployment, true)]);
    }

    public function progress(Deployment $deployment): JsonResponse
    {
        return response()->json(['data' => $deployment->only(['id', 'status', 'progress', 'current_stage', 'steps_completed', 'started_at', 'completed_at', 'duration_ms', 'error', 'warnings'])]);
    }

    public function events(Deployment $deployment): JsonResponse
    {
        return response()->json(['data' => $deployment->events()->orderBy('created_at')->orderBy('id')->get()->map(fn ($event) => $this->safeArray($event->toArray()))]);
    }

    public function items(Deployment $deployment): JsonResponse
    {
        return response()->json(['data' => $deployment->items()->oldest()->get()]);
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
        $data = $request->validate([
            'wordpress_connection_id' => 'required|uuid', 'included_pages' => 'sometimes|array',
            'included_pages.*' => 'string|max:255', 'overwrite_existing' => 'sometimes|boolean',
            'set_homepage' => 'sometimes|boolean', 'update_navigation' => 'sometimes|boolean',
            'regenerate_elementor_css' => 'sometimes|boolean', 'page_status' => 'sometimes|in:draft,publish',
        ]);
        $revision = $project->approvedRevision;
        if (! $revision || $revision->status !== 'approved') {
            return response()->json(['error' => ['code' => 'approved_revision_required', 'message' => 'Approve a rendered website revision before deployment.']], 409);
        }
        $run = $revision->generation_run_id ? $project->generationRuns()->findOrFail($revision->generation_run_id) : $project->generationRuns()->whereIn('status', ['succeeded', 'completed'])->latest()->firstOrFail();
        $connection = WordPressConnection::where('organization_id', $project->organization_id)->findOrFail($data['wordpress_connection_id']);
        if ($connection->status !== 'verified') {
            return response()->json(['error' => ['code' => 'connection_not_verified', 'message' => 'Test the WordPress connection successfully before continuing.']], 409);
        }
        if (! in_array($run->status, ['succeeded', 'completed'], true)) {
            return response()->json(['error' => ['code' => 'generation_not_ready', 'message' => 'A successful generation is required.']], 409);
        }
        if (! $dryRun && Deployment::where('project_id', $project->id)->where('dry_run', false)->whereIn('status', ['queued', 'running', 'cancelling'])->exists()) {
            return response()->json(['error' => ['code' => 'deployment_active', 'message' => 'A live deployment is already active.']], 409);
        }
        if (! $dryRun && ! Deployment::where(['project_id' => $project->id, 'website_revision_id' => $revision->id, 'wordpress_connection_id' => $connection->id, 'dry_run' => true, 'status' => 'succeeded'])->exists()) {
            return response()->json(['error' => ['code' => 'preview_required', 'message' => 'Run a successful deployment preview first.']], 409);
        }
        $options = ['included_pages' => $data['included_pages'] ?? [], 'overwrite_existing' => $data['overwrite_existing'] ?? false, 'set_homepage' => $data['set_homepage'] ?? false, 'update_navigation' => $data['update_navigation'] ?? false, 'regenerate_elementor_css' => $data['regenerate_elementor_css'] ?? true, 'page_status' => $data['page_status'] ?? 'draft'];
        $deployment = $project->deployments()->create(['organization_id' => $project->organization_id, 'created_by' => $request->user()?->id, 'generation_run_id' => $run->id, 'website_revision_id' => $revision->id, 'wordpress_connection_id' => $connection->id, 'dry_run' => $dryRun, 'options' => $options, 'status' => 'queued', 'progress' => 0, 'queued_at' => now()]);
        $usage->record($organization, $dryRun ? 'deployment_preview_started' : 'live_deployments', 1, 'deployment', $deployment->id, 'deployment-started-'.$deployment->id);
        $deployment->events()->create(['stage' => 'system', 'event_type' => 'deployment.queued', 'progress' => 0, 'message' => 'Deployment queued.', 'created_at' => now()]);
        app(JobTransport::class)->deployment($deployment->id, $deployment->attempt ?? 1);

        return response()->json(['data' => $deployment->fresh('events')], 202);
    }

    public function retry(Request $request, Deployment $deployment, JobTransport $jobs): JsonResponse
    {
        [$allowed, $reason] = $this->retryEligibility($deployment);
        if (! $allowed) {
            return response()->json(['error' => ['code' => 'not_retryable', 'message' => $reason]], 409);
        }
        $copy = DB::transaction(function () use ($deployment, $request) {
            $source = Deployment::lockForUpdate()->findOrFail($deployment->id);
            if (Deployment::where('deployment_plan_id', $source->deployment_plan_id)->whereIn('status', ['queued', 'running', 'cancelling'])->exists()) {
                abort(409, 'An active deployment attempt already exists for this plan.');
            }
            $copy = $source->replicate(['status', 'progress', 'current_stage', 'operations', 'result', 'error', 'error_details', 'queued_at', 'heartbeat_at', 'worker_id', 'started_at', 'completed_at', 'failed_at', 'cancelled_at', 'idempotency_key']);
            $root = $source->parent_deployment_id ?: $source->id;
            $number = max((int) $source->attempt_number, (int) $source->attempt) + 1;
            $copy->fill(['parent_deployment_id' => $root, 'retry_of_id' => $source->id, 'attempt_number' => $number, 'attempt' => $number, 'initiated_by' => $request->user()?->id, 'created_by' => $request->user()?->id, 'idempotency_key' => (string) Str::uuid(), 'status' => 'queued', 'progress' => 0, 'current_stage' => null, 'queued_at' => now()]);
            $copy->save();

            return $copy;
        });
        $jobs->deployment($copy->id, $copy->attempt ?? 1);

        return response()->json(['data' => $copy], 202);
    }

    private function retryEligibility(Deployment $deployment): array
    {
        if (! in_array($deployment->status, ['failed', 'partially_succeeded', 'cancelled'], true)) {
            return [false, 'Only failed, partially successful, or cancelled deployments can be retried.'];
        }
        $plan = $deployment->deploymentPlan;
        if (! $plan || ! $plan->verifyIntegrity() || ! hash_equals((string) $deployment->approval_checksum, (string) $plan->approval_checksum)) {
            return [false, 'The approved plan is missing or no longer passes its checksum.'];
        }
        if ($deployment->wordpressConnection?->status !== 'verified') {
            return [false, 'Verify the WordPress connection before retrying.'];
        }
        if (Deployment::where('deployment_plan_id', $deployment->deployment_plan_id)->where('id', '!=', $deployment->id)->whereIn('status', ['queued', 'running', 'cancelling'])->exists()) {
            return [false, 'An active deployment attempt already exists for this plan.'];
        }

        return [true, null];
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

    /** Remove secret-shaped fields from user-facing persisted diagnostics. */
    private function safeArray(array $value): array
    {
        $blocked = ['password', 'token', 'secret', 'cookie', 'authorization', 'credential', 'api_key'];
        foreach ($value as $key => $item) {
            if (collect($blocked)->contains(fn (string $word) => str_contains(strtolower((string) $key), $word))) {
                unset($value[$key]);
            } elseif (is_array($item)) {
                $value[$key] = $this->safeArray($item);
            }
        }

        return $value;
    }

    private function safeDeployment(Deployment $deployment): array
    {
        return $this->safeArray($deployment->toArray());
    }
}
