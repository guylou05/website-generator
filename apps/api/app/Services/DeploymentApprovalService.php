<?php

namespace App\Services;

use App\Models\DeploymentPlan;

class DeploymentApprovalService
{
    public function canonical(mixed $value): string
    {
        if (is_array($value)) {
            if (! array_is_list($value)) {
                ksort($value);
            }
            foreach ($value as $key => $item) {
                $value[$key] = is_array($item) ? json_decode($this->canonical($item), true) : $item;
            }
        }

        return json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRESERVE_ZERO_FRACTION);
    }

    public function checksum(DeploymentPlan $plan): string
    {
        return hash('sha256', $this->canonical([
            'source_revision_id' => $plan->website_revision_id, 'revision_hash' => $plan->revision_hash,
            'wordpress_connection_id' => $plan->wordpress_connection_id, 'snapshot_hash' => $plan->snapshot_hash,
            'changes' => $plan->changes, 'options' => $plan->options ?? [], 'plan_version' => $plan->plan_version,
        ]));
    }

    public function warningIds(DeploymentPlan $plan): array
    {
        return collect($plan->warnings ?? [])->map(fn ($warning) => hash('sha256', (string) $warning))->values()->all();
    }

    public function eligibility(DeploymentPlan $plan): array
    {
        $errors = [];
        $revision = $plan->websiteRevision;
        $connection = $plan->wordpressConnection;
        if ($plan->status !== 'ready_for_review') {
            $errors[] = 'Plan is not ready for review.';
        }
        if (! $connection || $connection->status !== 'verified') {
            $errors[] = 'WordPress connection is not verified.';
        }
        if (! $revision) {
            $errors[] = 'Source revision no longer exists.';
        } elseif (! in_array($revision->status, ['ready', 'approved'], true) || ! ($revision->validation['valid'] ?? false) || ! $revision->elementor_output) {
            $errors[] = 'Source revision is not rendered and valid.';
        }
        if ($plan->safety_status === 'blocked' || collect($plan->changes)->contains(fn ($change) => ! ($change['safe'] ?? false))) {
            $errors[] = 'Plan contains blocking errors.';
        }
        if ($plan->superseded_by_id) {
            $errors[] = 'Plan has been superseded.';
        }
        if (! $plan->expires_at || $plan->expires_at->isPast()) {
            $errors[] = 'Plan snapshot is stale or expired.';
        }
        if ($revision && ! hash_equals((string) $plan->revision_hash, hash('sha256', $this->canonical(['blueprint' => $revision->blueprint, 'elementor' => $revision->elementor_output])))) {
            $errors[] = 'Generated revision has changed.';
        }
        if (! hash_equals((string) $plan->snapshot_hash, hash('sha256', $this->canonical($plan->snapshot)))) {
            $errors[] = 'WordPress snapshot integrity check failed.';
        }

        return $errors;
    }
}
