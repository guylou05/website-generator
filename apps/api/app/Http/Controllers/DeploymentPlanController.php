<?php

namespace App\Http\Controllers;

use App\Models\Deployment;
use App\Models\DeploymentPlan;
use App\Models\OrganizationMembership;
use App\Models\Project;
use App\Models\WebsiteRevision;
use App\Models\WordPressConnection;
use App\Services\AuditService;
use App\Services\DeploymentApprovalService;
use App\Services\DeploymentPlanService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class DeploymentPlanController extends Controller
{
    public function index(Project $project): JsonResponse
    {
        return response()->json(['data' => DeploymentPlan::where('project_id', $project->id)->latest()->get()]);
    }

    public function show(Request $request, DeploymentPlan $deploymentPlan, AuditService $audit): JsonResponse
    {
        $audit->record($request, 'deployment_plan.review_opened', DeploymentPlan::class, $deploymentPlan->id, ['project_id' => $deploymentPlan->project_id], $deploymentPlan->organization_id);

        return response()->json(['data' => $deploymentPlan]);
    }

    /** Return persisted comparison data only; this endpoint never contacts WordPress. */
    public function diffs(Request $request, DeploymentPlan $deploymentPlan): JsonResponse
    {
        $filters = $request->validate([
            'resource' => 'nullable|string|in:page,elementor,media,menu,homepage,seo,css,settings',
            'action' => 'nullable|string|in:create,update,delete,unchanged,regenerate,configure',
            'search' => 'nullable|string|max:100',
        ]);
        $changes = collect($deploymentPlan->changes ?? [])
            ->when($filters['resource'] ?? null, fn ($items, $resource) => $items->where('resource', $resource))
            ->when($filters['action'] ?? null, fn ($items, $action) => $items->where('action', $action))
            ->when($filters['search'] ?? null, function ($items, $search) {
                $needle = mb_strtolower($search);

                return $items->filter(fn ($change) => str_contains(mb_strtolower(implode(' ', [$change['label'] ?? '', $change['identifier'] ?? '', $change['reason'] ?? ''])), $needle));
            })->values();

        return response()->json(['data' => [
            'plan_id' => $deploymentPlan->id,
            'read_only' => true,
            'safety_status' => $deploymentPlan->safety_status,
            'warnings' => $deploymentPlan->warnings,
            'statistics' => $deploymentPlan->statistics,
            'filtered_total' => $changes->count(),
            'changes' => $changes,
        ]]);
    }

    public function store(Request $request, Project $project, DeploymentPlanService $service, DeploymentApprovalService $approval, AuditService $audit): JsonResponse
    {
        $data = $request->validate(['website_revision_id' => 'nullable|uuid', 'wordpress_connection_id' => 'required|uuid']);
        $revision = isset($data['website_revision_id']) ? WebsiteRevision::where('project_id', $project->id)->findOrFail($data['website_revision_id']) : $project->approvedRevision;
        if (! $revision) {
            return response()->json(['error' => ['code' => 'revision_required', 'message' => 'Select a website revision to compare.']], 409);
        }
        $connection = WordPressConnection::where('organization_id', $project->organization_id)->findOrFail($data['wordpress_connection_id']);
        if ($connection->status !== 'verified') {
            return response()->json(['error' => ['code' => 'connection_not_verified', 'message' => 'Verify the WordPress connection before creating a plan.']], 409);
        }
        try {
            $snapshot = $service->snapshot($connection);
        } catch (RuntimeException $error) {
            return response()->json(['error' => ['code' => 'snapshot_failed', 'message' => $error->getMessage()]], 422);
        }
        $documents = $revision->elementor_output['documents'] ?? $revision->elementor_output ?? [];
        if (array_is_list($documents)) {
            $documents = collect($documents)->mapWithKeys(fn ($document) => [($document['page'] ?? '') => ($document['elements'] ?? $document)])->all();
        }
        $result = $service->compare($revision->blueprint ?? [], $documents, $snapshot);
        $now = now();
        $plan = DB::transaction(function () use ($result, $project, $revision, $connection, $snapshot, $request, $approval, $now) {
            $plan = DeploymentPlan::create($result + ['organization_id' => $project->organization_id, 'project_id' => $project->id, 'website_revision_id' => $revision->id, 'wordpress_connection_id' => $connection->id, 'status' => 'ready_for_review', 'snapshot' => $snapshot, 'options' => [], 'snapshot_hash' => hash('sha256', $approval->canonical($snapshot)), 'revision_hash' => hash('sha256', $approval->canonical(['blueprint' => $revision->blueprint, 'elementor' => $revision->elementor_output])), 'snapshot_captured_at' => $now, 'expires_at' => $now->copy()->addMinutes(config('deployment.plan_max_age_minutes')), 'created_by' => $request->user()?->id]);
            DeploymentPlan::where('project_id', $project->id)->where('website_revision_id', $revision->id)->where('id', '!=', $plan->id)->whereIn('status', ['draft', 'ready_for_review', 'rejected'])->update(['status' => 'superseded', 'superseded_by_id' => $plan->id]);

            return $plan;
        });
        $audit->record($request, 'deployment_plan.created', DeploymentPlan::class, $plan->id, ['project_id' => $project->id], $project->organization_id);
        $audit->record($request, 'deployment_plan.ready_for_review', DeploymentPlan::class, $plan->id, ['project_id' => $project->id], $project->organization_id);

        return response()->json(['data' => $plan], 201);
    }

    public function approval(Request $request, DeploymentPlan $deploymentPlan, DeploymentApprovalService $service): JsonResponse
    {
        return response()->json(['data' => ['status' => $deploymentPlan->status, 'eligible' => $service->eligibility($deploymentPlan) === [], 'blocking_errors' => $service->eligibility($deploymentPlan), 'warning_ids' => $service->warningIds($deploymentPlan), 'approved_at' => $deploymentPlan->approved_at, 'approved_by' => $deploymentPlan->approved_by, 'comment' => $deploymentPlan->approval_comment, 'checksum_valid' => $deploymentPlan->status === 'approved' ? $deploymentPlan->verifyIntegrity() : null]]);
    }

    public function approve(Request $request, DeploymentPlan $deploymentPlan, DeploymentApprovalService $service, AuditService $audit): JsonResponse
    {
        $data = $request->validate(['acknowledged_warning_ids' => 'array', 'acknowledged_warning_ids.*' => 'string|size:64', 'comment' => 'nullable|string|max:2000']);
        $this->authorizeApproval($request, $deploymentPlan);
        try {
            $plan = DB::transaction(function () use ($deploymentPlan, $service, $data) {
                $plan = DeploymentPlan::whereKey($deploymentPlan->id)->lockForUpdate()->firstOrFail();
                $errors = $service->eligibility($plan);
                if ($errors) {
                    if (collect($errors)->contains(fn ($e) => str_contains($e, 'stale') || str_contains($e, 'changed'))) {
                        $plan->update(['status' => 'expired']);
                    } throw new RuntimeException(implode(' ', $errors));
                }
                $required = $service->warningIds($plan);
                $ack = array_values(array_unique($data['acknowledged_warning_ids'] ?? []));
                if (array_diff($required, $ack)) {
                    throw new RuntimeException('Every warning must be explicitly acknowledged.');
                }
                $plan->forceFill(['status' => 'approved', 'acknowledged_warning_ids' => $ack, 'approval_comment' => $data['comment'] ?? null, 'approved_at' => now(), 'approved_by' => request()->user()->id])->save();
                $plan->forceFill(['approval_checksum' => $service->checksum($plan)])->save();

                return $plan;
            });
        } catch (RuntimeException $error) {
            return response()->json(['error' => ['code' => 'approval_blocked', 'message' => $error->getMessage()]], 409);
        }
        foreach ($plan->acknowledged_warning_ids as $id) {
            $audit->record($request, 'deployment_plan.warning_acknowledged', DeploymentPlan::class, $plan->id, ['warning_id' => $id], $plan->organization_id);
        }
        $audit->record($request, 'deployment_plan.approved', DeploymentPlan::class, $plan->id, ['project_id' => $plan->project_id], $plan->organization_id);

        return response()->json(['data' => $plan]);
    }

    public function reject(Request $request, DeploymentPlan $deploymentPlan, AuditService $audit): JsonResponse
    {
        $data = $request->validate(['reason' => 'required|string|max:2000']);
        $this->authorizeApproval($request, $deploymentPlan);
        $plan = DB::transaction(function () use ($deploymentPlan, $data, $request) {
            $plan = DeploymentPlan::whereKey($deploymentPlan->id)->lockForUpdate()->firstOrFail();
            abort_unless($plan->status === 'ready_for_review', 409, 'Only a plan ready for review can be rejected.');
            $plan->update(['status' => 'rejected', 'rejected_at' => now(), 'rejected_by' => $request->user()->id, 'rejection_reason' => $data['reason']]);

            return $plan;
        });
        $audit->record($request, 'deployment_plan.rejected', DeploymentPlan::class, $plan->id, ['project_id' => $plan->project_id, 'reason' => $data['reason']], $plan->organization_id);

        return response()->json(['data' => $plan]);
    }

    public function reopen(Request $request, DeploymentPlan $deploymentPlan, AuditService $audit): JsonResponse
    {
        $this->authorizeApproval($request, $deploymentPlan);
        abort_unless($deploymentPlan->status === 'rejected', 409, 'Only rejected plans can be reopened.');
        abort_if(Deployment::where('project_id', $deploymentPlan->project_id)->where('website_revision_id', $deploymentPlan->website_revision_id)->exists(), 409, 'A deployment already exists.');
        $deploymentPlan->update(['status' => 'ready_for_review', 'rejected_at' => null, 'rejected_by' => null, 'rejection_reason' => null]);
        $audit->record($request, 'deployment_plan.reopened', DeploymentPlan::class, $deploymentPlan->id, [], $deploymentPlan->organization_id);

        return response()->json(['data' => $deploymentPlan]);
    }

    private function authorizeApproval(Request $request, DeploymentPlan $plan): void
    {
        $allowed = OrganizationMembership::where('organization_id', $plan->organization_id)->where('user_id', $request->user()->id)->where('status', 'active')->whereIn('role', ['owner', 'admin'])->exists();
        abort_unless($allowed, 403, 'You do not have permission to approve deployment plans.');
    }
}
