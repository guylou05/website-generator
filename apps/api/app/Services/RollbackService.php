<?php

namespace App\Services;

use App\Models\Deployment;
use App\Models\Rollback;
use App\Models\RollbackPlan;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RollbackService
{
    public function createPlan(Deployment $deployment, Request $request): RollbackPlan
    {
        $this->authorizeOperator($request, $deployment->organization_id);
        abort_if($deployment->dry_run, 409, 'Dry-run deployments cannot be rolled back.');
        abort_unless(in_array($deployment->status, ['completed', 'succeeded', 'partially_succeeded', 'failed', 'cancelled'], true), 409, 'Deployment did not reach a rollback-eligible state.');
        abort_unless($deployment->wordpressConnection()->exists(), 409, 'The target WordPress connection no longer exists.');
        $snapshot = $deployment->rollbackSnapshot;
        abort_unless($snapshot, 409, 'A rollback snapshot is required.');
        $canonical = app(DeploymentApprovalService::class)->canonical($snapshot->snapshot);
        abort_unless(hash_equals($snapshot->checksum, hash('sha256', $canonical)), 409, 'Rollback snapshot checksum is invalid.');
        $confirmedWrites = $deployment->items()->where('status', 'completed')->whereNotIn('operation', ['verify', 'read'])->exists()
            || collect($deployment->operations)->contains(fn ($operation) => in_array($operation['action'] ?? null, ['create', 'update', 'configure', 'upload'], true));
        abort_unless($confirmedWrites, 409, 'This deployment has no confirmed WordPress writes.');
        abort_if(Rollback::where('wordpress_connection_id', $deployment->wordpress_connection_id)->whereIn('status', ['approved', 'queued', 'running', 'cancelling'])->exists(), 409, 'Another operation is active for this WordPress site.');
        abort_if(Deployment::where('wordpress_connection_id', $deployment->wordpress_connection_id)->where('id', '!=', $deployment->id)->whereIn('status', ['queued', 'running', 'cancelling'])->exists(), 409, 'Another deployment is active for this WordPress site.');

        return DB::transaction(function () use ($deployment, $snapshot, $request) {
            $existing = RollbackPlan::where('source_deployment_id', $deployment->id)->first();
            if ($existing) {
                return $existing;
            }
            $resources = $this->resources($snapshot->snapshot, $deployment->operations ?? []);
            $payload = ['resources' => $resources, 'expected_remote_state' => $deployment->result ?? [], 'snapshot_checksum' => $snapshot->checksum, 'warnings' => $resources['warnings'], 'conflicts' => [], 'options' => ['conflict_policy' => 'skip', 'media_policy' => 'preserve']];
            $checksum = hash('sha256', app(DeploymentApprovalService::class)->canonical($payload));
            $plan = RollbackPlan::create(array_merge($payload, ['organization_id' => $deployment->organization_id, 'project_id' => $deployment->project_id, 'source_deployment_id' => $deployment->id, 'rollback_snapshot_id' => $snapshot->id, 'wordpress_connection_id' => $deployment->wordpress_connection_id, 'checksum' => $checksum, 'created_by' => $request->user()->id]));
            app(AuditService::class)->record($request, 'rollback_plan.created', 'rollback_plan', $plan->id, ['source_deployment_id' => $deployment->id, 'affected_item_count' => count($resources['restore']) + count($resources['trash'])], $deployment->organization_id);

            return $plan;
        });
    }

    public function approve(RollbackPlan $plan, Request $request): Rollback
    {
        $this->authorizeOperator($request, $plan->organization_id);
        $data = $request->validate(['reason' => 'required|string|min:10|max:2000', 'acknowledge_warnings' => 'required|accepted', 'acknowledged_conflicts' => 'sometimes|array', 'acknowledged_conflicts.*' => 'string']);
        $conflicts = collect($plan->conflicts ?? []);
        $acknowledged = collect($data['acknowledged_conflicts'] ?? []);
        if ($conflicts->contains(fn ($conflict) => ! $acknowledged->contains($conflict['id'] ?? ''))) {
            throw ValidationException::withMessages(['acknowledged_conflicts' => 'Every remote drift conflict must be acknowledged.']);
        }
        abort_unless($this->verifyPlan($plan), 409, 'Rollback plan integrity check failed.');

        return DB::transaction(function () use ($plan, $request, $data) {
            $plan->update(['status' => 'approved', 'approved_by' => $request->user()->id, 'approved_at' => now()]);
            $rollback = Rollback::firstOrCreate(['rollback_plan_id' => $plan->id], ['organization_id' => $plan->organization_id, 'project_id' => $plan->project_id, 'source_deployment_id' => $plan->source_deployment_id, 'rollback_snapshot_id' => $plan->rollback_snapshot_id, 'wordpress_connection_id' => $plan->wordpress_connection_id, 'status' => 'approved', 'initiated_by' => $request->user()->id, 'approved_by' => $request->user()->id, 'reason' => $data['reason'], 'idempotency_key' => 'rollback:'.$plan->id]);
            app(AuditService::class)->record($request, 'rollback.approved', 'rollback', $rollback->id, ['source_deployment_id' => $plan->source_deployment_id, 'warnings_acknowledged' => true, 'conflict_count' => count($plan->conflicts ?? [])], $plan->organization_id);

            return $rollback;
        });
    }

    public function verifyPlan(RollbackPlan $plan): bool
    {
        $snapshot = $plan->snapshot;
        if (! $snapshot || ! hash_equals($plan->snapshot_checksum, $snapshot->checksum)) {
            return false;
        }
        $payload = ['resources' => $plan->resources, 'expected_remote_state' => $plan->expected_remote_state, 'snapshot_checksum' => $plan->snapshot_checksum, 'warnings' => $plan->warnings, 'conflicts' => $plan->conflicts, 'options' => $plan->options];

        return hash_equals($plan->checksum, hash('sha256', app(DeploymentApprovalService::class)->canonical($payload)));
    }

    private function resources(array $snapshot, array $operations): array
    {
        $restore = [];
        foreach (['pages', 'elementor_documents', 'seo', 'menus', 'homepage', 'site_settings'] as $type) {
            foreach ((array) data_get($snapshot, $type, []) as $key => $value) {
                $restore[] = ['type' => $type, 'key' => (string) $key, 'before' => $value];
            }
        }
        $trash = collect($operations)->filter(fn ($op) => ($op['resource'] ?? null) === 'page' && ($op['action'] ?? null) === 'create')->map(fn ($op) => ['type' => 'page', 'key' => (string) ($op['identifier'] ?? ''), 'remote_id' => data_get($op, 'details.remote_id')])->values()->all();
        $media = collect($operations)->filter(fn ($op) => ($op['resource'] ?? null) === 'media' && ($op['action'] ?? null) === 'upload')->map(fn ($op) => ['type' => 'media', 'key' => (string) ($op['identifier'] ?? ''), 'action' => 'preserve'])->values()->all();

        return ['restore' => $restore, 'trash' => $trash, 'leave_untouched' => $media, 'warnings' => $media ? ['Uploaded media will remain in the Media Library.'] : []];
    }

    private function authorizeOperator(Request $request, string $organizationId): void
    {
        $membership = $request->user()?->membershipFor($organizationId);
        abort_unless($membership && in_array($membership->role, ['owner', 'admin'], true), 403, 'Owner or administrator permission is required for rollback.');
    }
}
