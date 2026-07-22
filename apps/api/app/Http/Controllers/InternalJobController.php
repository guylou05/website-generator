<?php

namespace App\Http\Controllers;

use App\Models\Deployment;
use App\Models\GenerationRun;
use App\Models\Organization;
use App\Services\EntitlementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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
        $c = $deployment->connection;
        $organization = Organization::findOrFail($deployment->organization_id);
        if (! $deployment->dry_run && config('billing.enforcement') && $entitlements->currentPlan($organization) === 'free') {
            return response()->json(['error' => $entitlements->denial($organization, 'live_deployments')], 402);
        }

        return response()->json(['data' => ['id' => $deployment->id, 'organization_id' => $deployment->organization_id, 'dry_run' => $deployment->dry_run, 'generation_output' => $deployment->generationRun->output, 'wordpress' => ['url' => $c->site_url, 'username' => $c->username, 'application_password' => $c->encrypted_application_password]]]);
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
        return $this->completed($request, $generationRun, ['output' => 'required|array']);
    }

    public function deploymentCompleted(Request $request, Deployment $deployment): JsonResponse
    {
        return $this->completed($request, $deployment, ['operations' => 'required|array', 'result' => 'required|array']);
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
        }

        return response()->json(['data' => $job->fresh('events')]);
    }

    private function failed(Request $request, $job): JsonResponse
    {
        $data = $request->validate(['code' => 'required|string|max:100', 'message' => 'required|string|max:1000', 'cancelled' => 'sometimes|boolean']);
        if (in_array($job->status, ['failed', 'cancelled'], true)) {
            return response()->json(['data' => $job]);
        }
        $status = ($data['cancelled'] ?? false) || $job->status === 'cancelling' ? 'cancelled' : 'failed';
        $job->update(['status' => $status, 'error' => $status === 'failed' ? ['code' => $data['code'], 'message' => $data['message']] : null, 'current_stage' => null, 'completed_at' => now()]);

        return response()->json(['data' => $job->fresh('events')]);
    }
}
