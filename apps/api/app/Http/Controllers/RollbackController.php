<?php

namespace App\Http\Controllers;

use App\Models\Deployment;
use App\Models\Rollback;
use App\Models\RollbackPlan;
use App\Services\AuditService;
use App\Services\JobTransport;
use App\Services\RollbackService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RollbackController extends Controller
{
    public function createPlan(Request $request, Deployment $deployment, RollbackService $service): JsonResponse
    {
        return response()->json(['data' => $service->createPlan($deployment, $request)], 201);
    }

    public function showPlan(RollbackPlan $rollbackPlan): JsonResponse
    {
        return response()->json(['data' => $rollbackPlan->load(['sourceDeployment:id,status,completed_at', 'rollback'])]);
    }

    public function approve(Request $request, RollbackPlan $rollbackPlan, RollbackService $service): JsonResponse
    {
        return response()->json(['data' => $service->approve($rollbackPlan, $request)], 201);
    }

    public function execute(Request $request, RollbackPlan $rollbackPlan, RollbackService $service, JobTransport $jobs): JsonResponse
    {
        abort_unless($rollbackPlan->status === 'approved' && $service->verifyPlan($rollbackPlan), 409, 'Only an intact approved rollback plan can execute.');
        $rollback = $rollbackPlan->rollback;
        abort_unless($rollback, 409, 'Approve the rollback first.');
        if (! in_array($rollback->status, ['approved', 'failed'], true)) {
            return response()->json(['data' => $rollback]);
        }
        $rollback->update(['status' => 'queued']);
        $rollback->events()->create(['stage' => 'system', 'event_type' => 'rollback.queued', 'progress' => 0, 'message' => 'Rollback queued.', 'created_at' => now()]);
        $jobs->rollback($rollback->id, $rollback->attempt);
        app(AuditService::class)->record($request, 'rollback.queued', 'rollback', $rollback->id, ['source_deployment_id' => $rollback->source_deployment_id], $rollback->organization_id);

        return response()->json(['data' => $rollback->fresh('events')], 202);
    }

    public function show(Rollback $rollback): JsonResponse
    {
        return response()->json(['data' => $rollback->load(['events', 'items', 'sourceDeployment:id,status,completed_at'])]);
    }

    public function events(Rollback $rollback): JsonResponse
    {
        return response()->json(['data' => $rollback->events()->oldest('created_at')->get()]);
    }

    public function items(Rollback $rollback): JsonResponse
    {
        return response()->json(['data' => $rollback->items()->oldest()->get()]);
    }

    public function cancel(Request $request, Rollback $rollback): JsonResponse
    {
        abort_unless(in_array($rollback->status, ['queued', 'running'], true), 409, 'Rollback cannot be cancelled.');
        $rollback->update(['status' => 'cancelling', 'cancellation_requested_at' => now()]);
        $rollback->events()->create(['stage' => $rollback->current_stage ?? 'system', 'event_type' => 'rollback.cancelling', 'progress' => $rollback->progress, 'message' => 'Cancellation requested.', 'created_at' => now()]);
        app(AuditService::class)->record($request, 'rollback.cancelled_requested', 'rollback', $rollback->id, [], $rollback->organization_id);

        return response()->json(['data' => $rollback->fresh('events')]);
    }

    public function retry(Rollback $rollback, JobTransport $jobs): JsonResponse
    {
        abort_unless(in_array($rollback->status, ['failed', 'partially_succeeded', 'cancelled'], true), 409, 'Rollback is not retryable.');
        abort_unless((bool) data_get($rollback->error_details, 'retryable', false), 409, 'Rollback failure is not retryable.');
        $rollback->update(['status' => 'queued', 'attempt' => $rollback->attempt + 1, 'failed_at' => null, 'cancelled_at' => null]);
        $jobs->rollback($rollback->id, $rollback->attempt);

        return response()->json(['data' => $rollback], 202);
    }
}
