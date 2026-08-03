<?php

namespace App\Http\Controllers;

use App\Models\Deployment;
use App\Models\DeploymentRollbackSnapshot;
use App\Models\DeploymentSnapshotUpload;
use App\Models\DeploymentSnapshotUploadChunk;
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

    public function deploymentRollbackSnapshotInit(Request $request, Deployment $deployment): JsonResponse
    {
        abort_unless($deployment->status === 'running', 409);
        $data = $request->validate([
            'checksum' => 'required|size:64', 'uncompressed_size' => 'required|integer|min:2',
            'compressed_size' => 'required|integer|min:1', 'content_type' => 'required|in:application/json',
            'content_encoding' => 'required|in:gzip', 'schema_version' => 'required|string|max:20', 'metrics' => 'required|array',
        ]);
        $limit = config('deployment.snapshot_max_bytes');
        if ($data['uncompressed_size'] > $limit) {
            return response()->json(['error' => ['code' => 'rollback_snapshot_too_large', 'retryability' => 'non_retryable_data_error', 'size_bytes' => $data['uncompressed_size'], 'limit_bytes' => $limit]], 413);
        }
        $uploadId = hash('sha256', $deployment->id.':'.$data['checksum']);
        DB::transaction(function () use ($deployment, $uploadId, $data) {
            $existing = DeploymentSnapshotUpload::where('deployment_id', $deployment->id)->lockForUpdate()->first();
            if ($existing && $existing->id !== $uploadId) {
                $existing->delete();
                $existing = null;
            }
            if (! $existing) {
                DeploymentSnapshotUpload::create(['id' => $uploadId, 'deployment_id' => $deployment->id, 'manifest' => $data, 'created_at' => now()]);
            }
        });

        return response()->json(['data' => ['upload_id' => $uploadId, 'chunk_size_bytes' => config('deployment.snapshot_chunk_max_bytes')]]);
    }

    public function deploymentRollbackSnapshotChunk(Request $request, Deployment $deployment): JsonResponse
    {
        abort_unless($deployment->status === 'running', 409);
        $data = $request->validate(['upload_id' => 'required|size:64', 'sequence' => 'required|integer|min:0', 'checksum' => 'required|size:64', 'data' => 'required|string']);
        $bytes = base64_decode($data['data'], true);
        abort_if($bytes === false || strlen($bytes) > config('deployment.snapshot_chunk_max_bytes'), 413, 'Snapshot chunk exceeds application limit.');
        abort_unless(hash_equals($data['checksum'], hash('sha256', $bytes)), 422, 'Snapshot chunk checksum mismatch.');
        $upload = DeploymentSnapshotUpload::whereKey($data['upload_id'])->where('deployment_id', $deployment->id)->firstOrFail();
        $chunk = DeploymentSnapshotUploadChunk::firstOrCreate(
            ['upload_id' => $upload->id, 'sequence' => $data['sequence']],
            ['checksum' => $data['checksum'], 'data' => $bytes]
        );
        abort_unless(hash_equals($data['checksum'], $chunk->checksum), 409, 'Chunk sequence already contains different data.');

        return response()->json(['data' => ['sequence' => $data['sequence'], 'checksum' => $data['checksum']]]);
    }

    public function deploymentRollbackSnapshotComplete(Request $request, Deployment $deployment): JsonResponse
    {
        $data = $request->validate(['upload_id' => 'required|size:64']);
        $upload = DeploymentSnapshotUpload::whereKey($data['upload_id'])->where('deployment_id', $deployment->id)->firstOrFail();
        $manifest = $upload->manifest;
        $compressed = DeploymentSnapshotUploadChunk::where('upload_id', $upload->id)
            ->orderBy('sequence')
            ->get(['data'])
            ->map(fn ($chunk) => is_resource($chunk->data) ? stream_get_contents($chunk->data) : $chunk->data)
            ->implode('');
        abort_unless(strlen($compressed) === $manifest['compressed_size'], 422, 'Snapshot upload is incomplete.');
        $json = gzdecode($compressed);
        abort_unless($json !== false && strlen($json) === $manifest['uncompressed_size'] && hash_equals($manifest['checksum'], hash('sha256', $json)), 422, 'Snapshot artifact checksum mismatch.');
        $decoded = json_decode($json, true, flags: JSON_THROW_ON_ERROR);
        abort_unless(is_array($decoded), 422);
        $snapshot = DB::transaction(function () use ($deployment, $decoded, $manifest, $upload) {
            $snapshot = DeploymentRollbackSnapshot::firstOrCreate(['deployment_id' => $deployment->id], [
                'snapshot' => $decoded, 'checksum' => $manifest['checksum'], 'artifact_path' => null,
                'uncompressed_size' => $manifest['uncompressed_size'], 'compressed_size' => $manifest['compressed_size'],
                'content_type' => $manifest['content_type'], 'content_encoding' => $manifest['content_encoding'],
                'schema_version' => $manifest['schema_version'], 'manifest' => $manifest['metrics'], 'created_at' => now(),
            ]);
            $deployment->update(['rollback_snapshot_id' => $snapshot->id]);
            $upload->delete();

            return $snapshot;
        });

        return response()->json(['data' => ['id' => $snapshot->id, 'checksum' => $snapshot->checksum, 'verified' => true]]);
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
        try {
            return $this->started($request, $deployment);
        } catch (QueryException $exception) {
            if (($exception->errorInfo[0] ?? null) !== '23514') {
                throw $exception;
            }
            Log::critical('Deployment status constraint is out of sync with the application', ['deployment_id' => $deployment->id, 'constraint' => 'deployments_status_check', 'exception' => $this->exceptionDetails($exception)]);

            return response()->json(['error' => ['code' => 'deployment_schema_mismatch', 'message' => 'Deployment claiming is unavailable because the database state machine is not configured.', 'current_status' => $deployment->fresh()->status]], 503);
        }
    }

    public function deploymentRunning(Request $request, Deployment $deployment): JsonResponse
    {
        $data = $request->validate(['lease_token' => 'required|string|size:64']);

        return DB::transaction(function () use ($deployment, $data) {
            $locked = Deployment::lockForUpdate()->findOrFail($deployment->id);
            if ($locked->status !== 'claimed' || ! hash_equals((string) $locked->lease_token, $data['lease_token'])) {
                return $this->stateConflict($locked, 'claimed', 'start');
            }
            $locked->transitionTo('running', ['started_at' => $locked->started_at ?: now(), 'heartbeat_at' => now()]);
            $locked->events()->create(['event_uuid' => (string) Str::uuid(), 'stage' => 'deployment', 'event_type' => 'deployment.started', 'progress' => $locked->progress, 'message' => 'WordPress deployment started', 'created_at' => now()]);

            return response()->json(['data' => $locked->fresh()]);
        });
    }

    public function generationHeartbeat(Request $request, GenerationRun $generationRun): JsonResponse
    {
        return $this->heartbeat($request, $generationRun);
    }

    public function deploymentHeartbeat(Request $request, Deployment $deployment): JsonResponse
    {
        return $this->heartbeat($request, $deployment);
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
            $data = $request->validate(['lease_token' => 'required|string|size:64', 'completion_idempotency_key' => 'required|string|max:255', 'completion_checksum' => 'required|string|size:64', 'output' => 'required|array', 'output.blueprint' => 'required|array', 'output.blueprint.pages' => 'required|array|min:1', 'output.elementor' => 'required|array', 'output.elementor.status' => 'required|in:ready', 'output.elementor.documents' => 'required|array|min:1', 'output.elementor.documents.*.page' => 'required|string', 'output.elementor.documents.*.elements' => 'present|array']);
            Log::info('Generation completion payload validation completed', ['generation_run_id' => $generationRun->id]);

            Log::info('Generation completion database transaction starting', ['generation_run_id' => $generationRun->id]);
            $response = DB::transaction(function () use ($generationRun, $data) {
                Log::info('Generation completion database transaction started', ['generation_run_id' => $generationRun->id]);
                $job = GenerationRun::lockForUpdate()->findOrFail($generationRun->id);
                Log::info('Generation run locked for completion', ['generation_run_id' => $job->id, 'status' => $job->status]);
                if ($job->status === 'succeeded' && hash_equals((string) $job->completion_idempotency_key, $data['completion_idempotency_key']) && hash_equals((string) $job->completion_checksum, $data['completion_checksum'])) {
                    Log::info('Generation completion already persisted', ['generation_run_id' => $job->id]);

                    return response()->json(['data' => $job]);
                }
                if ($job->status !== 'running' || ! hash_equals((string) $job->lease_token, $data['lease_token'])) {
                    return $this->stateConflict($job, 'running', 'complete');
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
                $job->update(['status' => 'succeeded', 'progress' => 100, 'current_stage' => null, 'completed_at' => now(), 'error' => null, 'completion_idempotency_key' => $data['completion_idempotency_key'], 'completion_checksum' => $data['completion_checksum'], 'lease_token' => null, 'lease_expires_at' => null]);
                Log::info('Generation run completion update completed', ['generation_run_id' => $job->id]);

                Log::info('Final generation event emission started', ['generation_run_id' => $job->id]);
                $job->events()->firstOrCreate(['event_uuid' => $this->eventUuid("generation:{$job->id}:{$data['completion_idempotency_key']}:completed")], ['stage' => 'completion', 'event_type' => 'generation.completed', 'progress' => 100, 'message' => 'Generation completed', 'metadata' => ['revision_id' => $revision->id], 'created_at' => now()]);
                Log::info('Final generation event emission completed', ['generation_run_id' => $job->id]);

                return response()->json(['data' => $job->fresh('events')]);
            }, 3);
            Log::info('Generation completion database transaction committed', ['generation_run_id' => $generationRun->id]);

            return $response;
        } catch (Throwable $exception) {
            $details = $this->exceptionDetails($exception);
            Log::error('Post-blueprint generation completion failed', ['generation_run_id' => $generationRun->id, 'exception' => $details]);
            Log::info('Complete generation exception persistence started', ['generation_run_id' => $generationRun->id]);
            GenerationRun::whereKey($generationRun->id)->where('status', 'running')->where('lease_token', $request->input('lease_token'))->update(['status' => 'failed', 'error' => ['code' => $exception::class, 'message' => $exception->getMessage()], 'current_stage' => null, 'completed_at' => now(), 'lease_token' => null, 'lease_expires_at' => null]);
            Log::info('Complete generation exception persistence completed', ['generation_run_id' => $generationRun->id]);
            throw $exception;
        }
    }

    public function deploymentCompleted(Request $request, Deployment $deployment): JsonResponse
    {
        abort_unless(! $deployment->deployment_plan_id || $deployment->rollback_snapshot_id, 409, 'Rollback snapshot is required before completion.');
        $response = $this->completed($request, $deployment, ['lease_token' => 'required|string|size:64', 'completion_idempotency_key' => 'required|string|max:255', 'completion_checksum' => 'required|string|size:64', 'operations' => 'required|array', 'result' => 'required|array']);
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
        $data = $request->validate(['worker_id' => 'required|string|max:255', 'attempt' => 'sometimes|integer|min:1', 'idempotency_key' => 'sometimes|string|max:255']);

        return DB::transaction(function () use ($job, $data) {
            $locked = $job::lockForUpdate()->findOrFail($job->id);
            $attempt = $data['attempt'] ?? $locked->attempt;
            if ($locked->status !== 'queued' || $attempt !== $locked->attempt || $attempt > $locked->max_attempts) {
                return $this->claimConflict($locked);
            }
            $lease = hash('sha256', Str::random(64));
            $locked->increment('queue_delivery_count');
            $locked->update(['status' => 'claimed', 'worker_id' => $data['worker_id'], 'claimed_by_worker_id' => $data['worker_id'], 'lease_token' => $lease, 'lease_expires_at' => now()->addSeconds(config('app.job_lease_seconds', 90)), 'heartbeat_at' => now()]);
            if ($locked instanceof Deployment) {
                $locked->events()->create(['event_uuid' => (string) Str::uuid(), 'stage' => 'deployment', 'event_type' => 'deployment.claimed', 'progress' => $locked->progress, 'message' => 'Worker claimed deployment', 'created_at' => now()]);
            } else {
                $locked->update(['status' => 'running', 'started_at' => $locked->started_at ?: now()]);
            }

            return response()->json(['data' => $locked->fresh()->toArray() + ['claimed' => true]]);
        });
    }

    private function heartbeat(Request $request, $job): JsonResponse
    {
        $data = $request->validate(['lease_token' => 'required|string|size:64']);

        return DB::transaction(function () use ($job, $data) {
            $locked = $job::lockForUpdate()->findOrFail($job->id);
            if (! in_array($locked->status, ['running', 'cancelling'], true) || ! hash_equals((string) $locked->lease_token, $data['lease_token'])) {
                return $this->stateConflict($locked, 'running', 'heartbeat');
            }
            $locked->update(['heartbeat_at' => now(), 'lease_expires_at' => now()->addSeconds(config('app.job_lease_seconds', 90))]);

            return response()->json(['data' => $locked->fresh()]);
        });
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
        if ($job->status === 'succeeded' && hash_equals((string) $job->completion_idempotency_key, (string) ($data['completion_idempotency_key'] ?? '')) && hash_equals((string) $job->completion_checksum, (string) ($data['completion_checksum'] ?? ''))) {
            return response()->json(['data' => $job]);
        }
        if (in_array($job->status, ['cancelling', 'cancelled'], true)) {
            return response()->json(['error' => ['code' => 'cancelled', 'message' => 'Cancelled jobs cannot complete.']], 409);
        }
        if ($job->status !== 'running' || ! hash_equals((string) $job->lease_token, (string) ($data['lease_token'] ?? ''))) {
            return $this->stateConflict($job, 'running', 'complete');
        }
        unset($data['lease_token']);
        $job->update($data + ['status' => 'succeeded', 'progress' => 100, 'current_stage' => null, 'completed_at' => now(), 'lease_token' => null, 'lease_expires_at' => null]);
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
        if ($job->status === 'succeeded') {
            return $this->stateConflict($job, 'running', 'fail');
        }
        $status = ($data['cancelled'] ?? false) || $job->status === 'cancelling' ? 'cancelled' : 'failed';
        $endedAt = now();
        $classification = $data['code'] === 'rollback_snapshot_too_large' ? 'non_retryable_data_error' : (str_contains($data['code'], 'Configuration') ? 'retryable_after_configuration_change' : 'non_retryable_data_error');
        $message = $classification === 'retryable_after_configuration_change'
            ? 'The deployment client used an invalid authentication configuration. Verify the WordPress connection and retry after the deployment service is updated.'
            : ($data['code'] === 'rollback_snapshot_too_large' ? 'Rollback snapshot exceeded the current storage limit. No WordPress changes were made.' : $data['message']);
        $updates = ['status' => $status, 'error' => $status === 'failed' ? ['code' => $data['code'], 'classification' => $classification, 'retryable' => false, 'message' => $message, 'suggested_action' => $data['code'] === 'rollback_snapshot_too_large' ? 'Reduce unusually large page data or contact an administrator to increase artifact storage.' : null, 'details' => $data['details'] ?? null] : null, 'error_details' => $data['details'] ?? null, 'completed_at' => $endedAt];
        if ($job instanceof Deployment) {
            $stage = $job->current_stage ?: 'verify_connection';
            $updates += ['current_stage' => $stage, 'failed_at' => $status === 'failed' ? $endedAt : null, 'cancelled_at' => $status === 'cancelled' ? $endedAt : null, 'duration_ms' => $job->started_at ? $endedAt->diffInMilliseconds($job->started_at, true) : 0];
            $job->events()->create(['event_uuid' => (string) Str::uuid(), 'stage' => $stage, 'event_type' => 'stage.failed', 'progress' => $job->progress, 'message' => $message, 'metadata' => ['code' => $data['code'], 'classification' => $classification, 'terminal' => true], 'created_at' => $endedAt]);
        } else {
            $updates['current_stage'] = null;
        }
        $job->update($updates);

        return response()->json(['data' => $job->fresh('events')]);
    }

    private function exceptionDetails(Throwable $exception): array
    {
        $details = ['class' => $exception::class, 'message' => $exception->getMessage(), 'code' => $exception->getCode()];
        if ($exception instanceof QueryException) {
            $details['database'] = ['connection' => $exception->getConnectionName(), 'sql_state' => $exception->errorInfo[0] ?? null];
        }
        if ($exception instanceof ValidationException) {
            $details['validation_errors'] = $exception->errors();
        }
        if ($exception->getPrevious()) {
            $details['previous'] = $this->exceptionDetails($exception->getPrevious());
        }

        return $details;
    }

    private function stateConflict($job, string $expected, string $transition): JsonResponse
    {
        Log::warning('Job state transition conflict', ['generation_run_id' => $job instanceof GenerationRun ? $job->id : null, 'deployment_id' => $job instanceof Deployment ? $job->id : null, 'queue_job_id' => request()->header('X-Queue-Job-Id'), 'current_database_status' => $job->status, 'expected_status' => $expected, 'worker_id' => request()->input('worker_id'), 'lease_owner' => $job->claimed_by_worker_id, 'lease_expiration' => $job->lease_expires_at, 'attempt_number' => $job instanceof Deployment ? $job->attempt_number : $job->attempt, 'last_heartbeat' => $job->heartbeat_at, 'completed_at' => $job->completed_at, 'failed_at' => $job instanceof Deployment ? $job->failed_at : null, 'transition' => $transition]);

        return response()->json(['error' => ['code' => $job instanceof GenerationRun ? 'generation_state_conflict' : 'deployment_state_conflict', 'current_status' => $job->status, 'expected_status' => $expected, 'transition' => $transition]], 409);
    }

    private function claimConflict($job): JsonResponse
    {
        return response()->json(['error' => ['code' => $job instanceof Deployment ? 'deployment_claim_conflict' : 'generation_claim_conflict', 'message' => 'The deployment could not be claimed because its state changed.', 'current_status' => $job->status]], 409);
    }

    private function eventUuid(string $key): string
    {
        $hex = md5($key);

        return substr($hex, 0, 8).'-'.substr($hex, 8, 4).'-5'.substr($hex, 13, 3).'-a'.substr($hex, 17, 3).'-'.substr($hex, 20, 12);
    }
}
