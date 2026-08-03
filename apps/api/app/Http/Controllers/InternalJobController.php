<?php

namespace App\Http\Controllers;

use App\Models\Deployment;
use App\Models\DeploymentRollbackSnapshot;
use App\Models\GenerationRun;
use App\Models\Organization;
use App\Services\DeploymentApprovalService;
use App\Services\EntitlementService;
use App\Services\WebsiteRevisionService;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

class InternalJobController extends Controller
{
    public function generationContext(GenerationRun $generationRun, EntitlementService $entitlements): JsonResponse
    {
        $organization = Organization::findOrFail($generationRun->organization_id);
        $plan = $entitlements->currentPlan($organization);
        if (config('billing.enforcement') && ! in_array($generationRun->provider, config("billing.plans.$plan.entitlements.providers"), true)) {
            return response()->json(['error' => $entitlements->denial($organization, 'generations') + ['code' => 'provider_not_entitled']], 402);
        }

        return response()->json(['data' => ['id' => $generationRun->id, 'organization_id' => $generationRun->organization_id, 'project_id' => $generationRun->project_id, 'provider' => $generationRun->provider, 'allowed_provider' => $generationRun->provider, 'entitlement_snapshot' => ['plan' => $plan, 'generation_remaining' => $entitlements->remainingUsage($organization, 'generations')], 'input' => $generationRun->input, 'business_profile' => $generationRun->project->business_profile, 'attempt' => $generationRun->attempt]]);
    }

    public function deploymentContext(Deployment $deployment, EntitlementService $entitlements): JsonResponse
    {
        $c = $deployment->wordpressConnection;
        $plan = $deployment->deploymentPlan;
        abort_unless($plan && $plan->organization_id === $deployment->organization_id && $plan->project_id === $deployment->project_id && $plan->website_revision_id === $deployment->website_revision_id && $plan->wordpress_connection_id === $deployment->wordpress_connection_id, 404);
        abort_unless($plan->verifyIntegrity() && hash_equals((string) $deployment->approval_checksum, (string) $plan->approval_checksum), 409, 'Approved plan integrity verification failed.');
        $organization = Organization::findOrFail($deployment->organization_id);
        if (! $deployment->dry_run && config('billing.enforcement') && $entitlements->currentPlan($organization) === 'free') {
            return response()->json(['error' => $entitlements->denial($organization, 'live_deployments')], 402);
        }

        $revision = $deployment->websiteRevision;

        return response()->json(['data' => [
            'id' => $deployment->id, 'organization_id' => $deployment->organization_id, 'project_id' => $deployment->project_id,
            'dry_run' => false, 'approval_checksum' => $deployment->approval_checksum,
            'plan' => ['id' => $plan->id, 'version' => $plan->plan_version, 'changes' => $plan->changes, 'options' => $deployment->options, 'snapshot' => $plan->snapshot],
            'generation_output' => ['blueprint' => $revision->blueprint, 'elementor' => $revision->elementor_output],
            // This route is worker-authenticated and never mounted in the browser route group.
            'wordpress_connection' => ['url' => $c->site_url, 'authentication_type' => $c->authentication_type, 'username' => $c->username, 'application_password' => $c->encrypted_application_password, 'connector_token' => $c->encrypted_connector_token],
        ]]);
    }

    public function deploymentRollbackSnapshot(Request $request, Deployment $deployment): JsonResponse
    {
        abort_unless(in_array($deployment->status, ['running', 'cancelling'], true), 409);
        $data = $request->validate(['snapshot' => 'required|array|max:5000']);
        $canonical = app(DeploymentApprovalService::class)->canonical($data['snapshot']);
        $snapshot = DeploymentRollbackSnapshot::firstOrCreate(
            ['deployment_id' => $deployment->id],
            ['snapshot' => $data['snapshot'], 'checksum' => hash('sha256', $canonical), 'created_at' => now()]
        );
        if (! $deployment->rollback_snapshot_id) {
            $deployment->update(['rollback_snapshot_id' => $snapshot->id]);
        }

        return response()->json(['data' => ['id' => $snapshot->id, 'checksum' => $snapshot->checksum]], $snapshot->wasRecentlyCreated ? 201 : 200);
    }

    public function generationCancellation(GenerationRun $generationRun): JsonResponse
    {
        return response()->json(['cancelled' => in_array($generationRun->status, ['cancelling', 'cancelled'], true)]);
    }

    public function deploymentCancellation(Deployment $deployment): JsonResponse
    {
        return response()->json(['cancelled' => in_array($deployment->status, ['cancelling', 'cancelled'], true)]);
    }

    public function generationStarted(Request $request, GenerationRun $generationRun): JsonResponse
    {
        return $this->started($request, $generationRun);
    }

    public function deploymentStarted(Request $request, Deployment $deployment): JsonResponse
    {
        return $this->started($request, $deployment);
    }

    public function generationHeartbeat(GenerationRun $generationRun): JsonResponse
    {
        return $this->heartbeat($generationRun);
    }

    public function deploymentHeartbeat(Deployment $deployment): JsonResponse
    {
        return $this->heartbeat($deployment);
    }

    public function generationEvent(Request $request, GenerationRun $generationRun): JsonResponse
    {
        return $this->event($request, $generationRun);
    }

    public function deploymentEvent(Request $request, Deployment $deployment): JsonResponse
    {
        return $this->event($request, $deployment);
    }

    public function generationCompleted(Request $request, GenerationRun $generationRun): JsonResponse
    {
        Log::info('Post-blueprint completion request received', ['generation_run_id' => $generationRun->id]);
        try {
            Log::info('Generation completion payload validation started', ['generation_run_id' => $generationRun->id]);
            $data = $request->validate(['output' => 'required|array', 'output.blueprint' => 'required|array', 'output.blueprint.pages' => 'required|array|min:1', 'output.elementor' => 'required|array', 'output.elementor.status' => 'required|in:ready', 'output.elementor.documents' => 'required|array|min:1', 'output.elementor.documents.*.page' => 'required|string', 'output.elementor.documents.*.elements' => 'present|array']);
            Log::info('Generation completion payload validation completed', ['generation_run_id' => $generationRun->id]);

            Log::info('Generation completion database transaction starting', ['generation_run_id' => $generationRun->id]);
            $response = DB::transaction(function () use ($generationRun, $data) {
                Log::info('Generation completion database transaction started', ['generation_run_id' => $generationRun->id]);
                $job = GenerationRun::lockForUpdate()->findOrFail($generationRun->id);
                Log::info('Generation run locked for completion', ['generation_run_id' => $job->id, 'status' => $job->status]);
                if ($job->status === 'succeeded') {
                    Log::info('Generation completion already persisted', ['generation_run_id' => $job->id]);

                    return response()->json(['data' => $job]);
                }
                if (in_array($job->status, ['cancelling', 'cancelled'], true)) {
                    return response()->json(['error' => ['code' => 'cancelled', 'message' => 'Cancelled jobs cannot complete.']], 409);
                }
                if ($job->status !== 'running') {
                    return response()->json(['error' => ['code' => 'invalid_state', 'message' => 'Job is not running.']], 409);
                }

                $revision = $job->project->websiteRevisions()->where('generation_run_id', $job->id)->first();
                if (! $revision) {
                    Log::info('Website revision and pages creation started', ['generation_run_id' => $job->id]);
                    $revision = app(WebsiteRevisionService::class)->create($job->project, $data['output']['blueprint'], 'generation', null, $job->id);
                    Log::info('Website revision and pages creation completed', ['generation_run_id' => $job->id, 'revision_id' => $revision->id, 'pages' => count($revision->blueprint['pages'] ?? [])]);
                }

                Log::info('Persisted blueprint validation started', ['generation_run_id' => $job->id, 'revision_id' => $revision->id]);
                $validation = app(WebsiteRevisionService::class)->validate($revision);
                Log::info('Persisted blueprint validation completed', ['generation_run_id' => $job->id, 'revision_id' => $revision->id, 'valid' => $validation['valid'], 'validation_errors' => $validation['errors']]);
                if (! $validation['valid']) {
                    throw ValidationException::withMessages(['output.blueprint' => ['The persisted blueprint failed canonical validation.']]);
                }

                $pageIds = collect($revision->blueprint['pages'])->pluck('id')->sort()->values();
                $renderedPageIds = collect($data['output']['elementor']['documents'])->pluck('page')->unique()->sort()->values();
                if ($pageIds->all() !== $renderedPageIds->all() || count($data['output']['elementor']['documents']) !== $pageIds->count()) {
                    throw ValidationException::withMessages(['output.elementor.documents' => ['Every blueprint page must have exactly one Elementor render document.']]);
                }

                $pageCount = $pageIds->count();
                $output = $data['output'];
                $output['summary'] = ['pages_generated' => $pageCount, 'blueprint_valid' => true, 'elementor_ready' => true];
                Log::info('Blueprint persistence started', ['generation_run_id' => $job->id]);
                $job->update(['output' => $output]);
                Log::info('Blueprint persistence completed', ['generation_run_id' => $job->id]);

                $revision->update(['elementor_output' => $output['elementor'], 'status' => 'ready']);
                Log::info('Rendered pages persistence completed', ['generation_run_id' => $job->id, 'revision_id' => $revision->id]);

                Log::info('Project status update started', ['generation_run_id' => $job->id]);
                $job->project()->update(['latest_revision_id' => $revision->id, 'status' => 'ready']);
                Log::info('Project status update completed', ['generation_run_id' => $job->id]);

                Log::info('Generation run completion update started', ['generation_run_id' => $job->id]);
                $job->update(['status' => 'succeeded', 'progress' => 100, 'current_stage' => null, 'completed_at' => now(), 'error' => null]);
                Log::info('Generation run completion update completed', ['generation_run_id' => $job->id]);

                Log::info('Final generation event emission started', ['generation_run_id' => $job->id]);
                $job->events()->create(['event_uuid' => (string) Str::uuid(), 'stage' => 'completion', 'event_type' => 'generation.completed', 'progress' => 100, 'message' => 'Generation completed', 'metadata' => ['revision_id' => $revision->id], 'created_at' => now()]);
                Log::info('Final generation event emission completed', ['generation_run_id' => $job->id]);

                return response()->json(['data' => $job->fresh('events')]);
            }, 3);
            Log::info('Generation completion database transaction committed', ['generation_run_id' => $generationRun->id]);

            return $response;
        } catch (Throwable $exception) {
            $details = $this->exceptionDetails($exception);
            Log::error('Post-blueprint generation completion failed', ['generation_run_id' => $generationRun->id, 'exception' => $details]);
            Log::info('Complete generation exception persistence started', ['generation_run_id' => $generationRun->id]);
            GenerationRun::whereKey($generationRun->id)->update(['status' => 'failed', 'error' => ['code' => $exception::class, 'message' => $exception->getMessage(), 'details' => $details], 'current_stage' => null, 'completed_at' => now()]);
            Log::info('Complete generation exception persistence completed', ['generation_run_id' => $generationRun->id]);
            throw $exception;
        }
    }

    public function deploymentCompleted(Request $request, Deployment $deployment): JsonResponse
    {
        abort_unless(! $deployment->deployment_plan_id || $deployment->rollback_snapshot_id, 409, 'Rollback snapshot is required before completion.');
        $response = $this->completed($request, $deployment, ['operations' => 'required|array', 'result' => 'required|array']);
        if ($deployment->deployment_plan_id && $response->getStatusCode() < 300) {
            $deployment->wordpressConnection()->update(['last_deployment_at' => now()]);
            $deployment->project()->update(['last_deployment_id' => $deployment->id]);
        }

        return $response;
    }

    public function generationFailed(Request $request, GenerationRun $generationRun): JsonResponse
    {
        return $this->failed($request, $generationRun);
    }

    public function deploymentFailed(Request $request, Deployment $deployment): JsonResponse
    {
        return $this->failed($request, $deployment);
    }

    private function started(Request $request, $job): JsonResponse
    {
        $data = $request->validate(['worker_id' => 'required|string|max:255']);
        if ($job->status === 'running') {
            return response()->json(['data' => $job]);
        }
        if ($job->status !== 'queued') {
            return response()->json(['error' => ['code' => 'invalid_state', 'message' => 'Job cannot start.']], 409);
        }
        $job->update(['status' => 'running', 'worker_id' => $data['worker_id'], 'started_at' => now(), 'heartbeat_at' => now()]);

        return response()->json(['data' => $job]);
    }

    private function heartbeat($job): JsonResponse
    {
        if ($job->status === 'running') {
            $job->update(['heartbeat_at' => now()]);
        }

        return response()->json(['data' => $job->fresh()]);
    }

    private function event(Request $request, $job): JsonResponse
    {
        $data = $request->validate(['event_uuid' => 'required|uuid', 'stage' => 'required|string|max:100', 'event_type' => 'required|string|max:100', 'progress' => 'required|integer|min:0|max:100', 'message' => 'required|string|max:2000', 'metadata' => 'nullable|array']);
        $event = $job->events()->firstOrCreate(['event_uuid' => $data['event_uuid']], $data + ['created_at' => now()]);
        if ($job->status === 'running') {
            $job->update(['current_stage' => $data['stage'], 'progress' => $data['progress']]);
        }

        return response()->json(['data' => $event], $event->wasRecentlyCreated ? 201 : 200);
    }

    private function completed(Request $request, $job, array $rules): JsonResponse
    {
        $data = $request->validate($rules);
        if ($job->status === 'succeeded') {
            return response()->json(['data' => $job]);
        }
        if (in_array($job->status, ['cancelling', 'cancelled'], true)) {
            return response()->json(['error' => ['code' => 'cancelled', 'message' => 'Cancelled jobs cannot complete.']], 409);
        }
        if ($job->status !== 'running') {
            return response()->json(['error' => ['code' => 'invalid_state', 'message' => 'Job is not running.']], 409);
        }
        $job->update($data + ['status' => 'succeeded', 'progress' => 100, 'current_stage' => null, 'completed_at' => now()]);
        if ($job instanceof GenerationRun) {
            $job->project()->update(['status' => 'ready']);
            $output = $data['output'] ?? [];
            if (! $job->project->websiteRevisions()->where('generation_run_id', $job->id)->exists() && ! empty($output['blueprint'])) {
                $service = app(WebsiteRevisionService::class);
                $revision = $service->create($job->project, $output['blueprint'], 'generation', null, $job->id);
                $validation = $service->validate($revision);
                $revision->update(['elementor_output' => $output['elementor'] ?? null, 'status' => $validation['valid'] && ! empty($output['elementor']) ? 'ready' : 'invalid']);
            }
        }

        return response()->json(['data' => $job->fresh('events')]);
    }

    private function failed(Request $request, $job): JsonResponse
    {
        $data = $request->validate(['code' => 'required|string|max:255', 'message' => 'required|string|max:4000', 'details' => 'sometimes|array', 'cancelled' => 'sometimes|boolean']);
        if (in_array($job->status, ['failed', 'cancelled'], true)) {
            return response()->json(['data' => $job]);
        }
        $status = ($data['cancelled'] ?? false) || $job->status === 'cancelling' ? 'cancelled' : 'failed';
        $endedAt = now();
        $classification = str_contains($data['code'], 'Configuration') ? 'retryable_after_configuration_change' : 'non_retryable_data_error';
        $message = $classification === 'retryable_after_configuration_change'
            ? 'The deployment client used an invalid authentication configuration. Verify the WordPress connection and retry after the deployment service is updated.'
            : $data['message'];
        $updates = ['status' => $status, 'error' => $status === 'failed' ? ['code' => $data['code'], 'classification' => $classification, 'message' => $message, 'details' => $data['details'] ?? null] : null, 'completed_at' => $endedAt];
        if ($job instanceof Deployment) {
            $stage = $job->current_stage ?: 'verify_connection';
            $updates += ['current_stage' => $stage, 'failed_at' => $status === 'failed' ? $endedAt : null, 'cancelled_at' => $status === 'cancelled' ? $endedAt : null, 'duration_ms' => $job->started_at ? $endedAt->diffInMilliseconds($job->started_at, true) : 0];
            $job->events()->create(['event_uuid' => (string) Str::uuid(), 'stage' => $stage, 'event_type' => 'stage.failed', 'progress' => $job->progress, 'message' => $message, 'created_at' => $endedAt]);
        } else {
            $updates['current_stage'] = null;
        }
        $job->update($updates);

        return response()->json(['data' => $job->fresh('events')]);
    }

    private function exceptionDetails(Throwable $exception): array
    {
        $details = ['class' => $exception::class, 'message' => $exception->getMessage(), 'code' => $exception->getCode(), 'file' => $exception->getFile(), 'line' => $exception->getLine(), 'trace' => $exception->getTraceAsString()];
        if ($exception instanceof QueryException) {
            $details['sql'] = ['connection' => $exception->getConnectionName(), 'query' => $exception->getSql(), 'bindings' => $exception->getBindings(), 'error_info' => $exception->errorInfo];
        }
        if ($exception instanceof ValidationException) {
            $details['validation_errors'] = $exception->errors();
        }
        if ($exception->getPrevious()) {
            $details['previous'] = $this->exceptionDetails($exception->getPrevious());
        }

        return $details;
    }
}
