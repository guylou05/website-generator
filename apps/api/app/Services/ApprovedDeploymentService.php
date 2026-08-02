<?php

namespace App\Services;

use App\Models\Deployment;
use App\Models\DeploymentPlan;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ApprovedDeploymentService
{
    public function start(DeploymentPlan $routePlan, Request $request): Deployment
    {
        $deployment = DB::transaction(function () use ($routePlan, $request) {
            $plan = DeploymentPlan::with(['websiteRevision', 'wordpressConnection'])->lockForUpdate()->findOrFail($routePlan->id);
            $this->assertEligible($plan);

            $active = $plan->deployments()->whereIn('status', ['queued', 'running', 'cancelling'])->first();
            if ($active) {
                throw ValidationException::withMessages(['plan' => ['An active deployment already exists for this plan.']]);
            }

            $revision = $plan->websiteRevision;
            $deploymentId = (string) Str::uuid();
            $deployment = Deployment::create([
                'id' => $deploymentId,
                'organization_id' => $plan->organization_id,
                'project_id' => $plan->project_id,
                'deployment_plan_id' => $plan->id,
                'generation_run_id' => $revision->generation_run_id,
                'website_revision_id' => $revision->id,
                'wordpress_connection_id' => $plan->wordpress_connection_id,
                'status' => 'queued',
                'dry_run' => false,
                'progress' => 0,
                'created_by' => $request->user()?->id,
                'approval_checksum' => $plan->approval_checksum,
                'idempotency_key' => 'deployment:'.$deploymentId,
                'options' => ($plan->options ?? []) + ['acknowledged_warning_ids' => $plan->acknowledged_warning_ids ?? [], 'warnings' => $plan->warnings ?? []],
                'queued_at' => now(),
            ]);
            $deployment->events()->create(['stage' => 'system', 'event_type' => 'deployment.queued', 'progress' => 0, 'message' => 'Approved deployment queued.', 'metadata' => ['plan_id' => $plan->id], 'created_at' => now()]);
            app(AuditService::class)->record($request, 'deployment.queued', Deployment::class, $deployment->id, ['project_id' => $plan->project_id, 'plan_id' => $plan->id, 'revision_id' => $revision->id, 'connection_id' => $plan->wordpress_connection_id], $plan->organization_id);

            return $deployment;
        }, 3);

        // Publishing happens after commit: a worker can never observe an incomplete row.
        app(JobTransport::class)->deployment($deployment->id, 1);

        return $deployment->fresh(['events', 'items']);
    }

    private function assertEligible(DeploymentPlan $plan): void
    {
        $errors = [];
        if ($plan->status !== 'approved') {
            $errors[] = 'Plan is not approved.';
        }
        if (! $plan->approval_checksum || ! $plan->verifyIntegrity()) {
            $errors[] = 'Approval checksum or plan integrity verification failed.';
        }
        if ($plan->expires_at?->isPast()) {
            $errors[] = 'Plan has expired.';
        }
        if ($plan->superseded_by_id) {
            $errors[] = 'Plan has been superseded.';
        }
        $revision = $plan->websiteRevision;
        if (! $revision) {
            $errors[] = 'Source revision no longer exists.';
        } elseif (! in_array($revision->status, ['ready', 'approved'], true) || ! ($revision->validation['valid'] ?? false) || empty($revision->elementor_output)) {
            $errors[] = 'Source revision is not valid and rendered.';
        }
        $connection = $plan->wordpressConnection;
        if (! $connection || $connection->organization_id !== $plan->organization_id || $connection->status !== 'verified') {
            $errors[] = 'WordPress connection is not verified.';
        }
        if ($plan->safety_status === 'blocked' || collect($plan->changes ?? [])->contains(fn ($change) => ! ($change['safe'] ?? false))) {
            $errors[] = 'Plan contains blocking errors.';
        }
        if ($errors) {
            throw ValidationException::withMessages(['plan' => $errors]);
        }

        $approvedVersions = $plan->snapshot['versions'] ?? $plan->snapshot['environment'] ?? [];
        $health = app(WordPressConnectionService::class)->verify($connection);
        foreach (['wordpress_version' => 'wordpress_version', 'elementor_version' => 'elementor.version'] as $approvedKey => $healthKey) {
            $approved = data_get($approvedVersions, $approvedKey);
            $current = data_get($health, $healthKey);
            if ($approved && $current && $approved !== $current) {
                throw ValidationException::withMessages(['plan' => ['The WordPress environment changed since approval. Create a new dry run.']]);
            }
        }
    }
}
