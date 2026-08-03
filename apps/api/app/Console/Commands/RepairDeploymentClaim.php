<?php

namespace App\Console\Commands;

use App\Models\Deployment;
use App\Support\DeploymentStatus;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class RepairDeploymentClaim extends Command
{
    protected $signature = 'deployments:repair-claim {--deployment= : Deployment UUID}';

    protected $description = 'Inspect and safely repair one deployment affected by a failed worker claim';

    public function handle(): int
    {
        $id = $this->option('deployment');
        if (! $id) {
            $this->error('--deployment is required.');

            return self::INVALID;
        }

        return DB::transaction(function () use ($id) {
            $deployment = Deployment::withoutGlobalScopes()->lockForUpdate()->find($id);
            if (! $deployment) {
                $this->error('Deployment not found.');

                return self::FAILURE;
            }
            $terminalEvent = $deployment->events()->where(function ($query) {
                $query->where('event_type', 'like', '%.completed')->orWhere('event_type', 'like', '%.failed')->orWhere('metadata->terminal', true);
            })->latest('created_at')->first();
            $writes = $deployment->items()->where('status', 'completed')->whereNotIn('operation', ['verify', 'read'])->exists()
                || $deployment->rollbackSnapshot()->exists();
            $this->table(['Status', 'Lease owner', 'Lease expiry', 'Terminal event', 'WordPress writes'], [[
                $deployment->status, $deployment->claimed_by_worker_id ?: 'none', $deployment->lease_expires_at?->toIso8601String() ?: 'none', $terminalEvent?->event_type ?: 'none', $writes ? 'yes' : 'no',
            ]]);
            if (in_array($deployment->status, DeploymentStatus::TERMINAL, true)) {
                $this->info('No repair required: deployment is terminal.');

                return self::SUCCESS;
            }
            if ($deployment->status !== 'claimed' || ($deployment->lease_expires_at && $deployment->lease_expires_at->isFuture())) {
                $this->warn('No change: this is not an expired claimed deployment.');

                return self::SUCCESS;
            }
            $status = ($terminalEvent || $writes) ? 'failed' : 'queued';
            $deployment->transitionTo($status, [
                'worker_id' => null, 'claimed_by_worker_id' => null, 'lease_token' => null, 'lease_expires_at' => null,
                'heartbeat_at' => null, 'queued_at' => $status === 'queued' ? now() : $deployment->queued_at,
                'failed_at' => $status === 'failed' ? now() : null, 'completed_at' => $status === 'failed' ? now() : null,
            ]);
            $deployment->events()->create(['stage' => 'system', 'event_type' => 'deployment.claim_repaired', 'progress' => $deployment->progress, 'message' => "Administrative claim repair selected {$status} after inspecting lease, terminal events, and WordPress write evidence.", 'metadata' => ['previous_status' => 'claimed', 'write_evidence' => $writes, 'terminal_event' => $terminalEvent?->event_type], 'created_at' => now()]);
            $this->info("Deployment repaired to {$status}; audit event preserved.");

            return self::SUCCESS;
        });
    }
}
