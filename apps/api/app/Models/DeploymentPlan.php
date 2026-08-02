<?php

namespace App\Models;

use App\Models\Concerns\TenantBound;
use App\Services\DeploymentApprovalService;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

class DeploymentPlan extends Model
{
    use HasUuids, TenantBound { TenantBound::resolveRouteBindingQuery insteadof HasUuids; }

    public const STATUSES = ['draft', 'ready_for_review', 'approved', 'rejected', 'expired', 'superseded'];

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['snapshot' => 'array', 'changes' => 'array', 'statistics' => 'array', 'warnings' => 'array', 'options' => 'array', 'acknowledged_warning_ids' => 'array', 'estimated_seconds' => 'integer', 'approved_at' => 'datetime', 'rejected_at' => 'datetime', 'expires_at' => 'datetime', 'snapshot_captured_at' => 'datetime'];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function websiteRevision(): BelongsTo
    {
        return $this->belongsTo(WebsiteRevision::class);
    }

    public function wordpressConnection(): BelongsTo
    {
        return $this->belongsTo(WordPressConnection::class);
    }

    public function verifyIntegrity(): bool
    {
        return $this->status === 'approved' && hash_equals((string) $this->approval_checksum, app(DeploymentApprovalService::class)->checksum($this));
    }

    protected static function booted(): void
    {
        static::updating(function (self $plan): void {
            if ($plan->getOriginal('status') === 'approved' && array_diff(array_keys($plan->getDirty()), ['approval_checksum', 'updated_at'])) {
                throw new LogicException('Approved deployment plans are immutable. Create a new dry run.');
            }
        });
    }
}
