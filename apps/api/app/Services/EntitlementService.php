<?php

namespace App\Services;

use App\Models\Organization;
use App\Models\Project;
use App\Models\Subscription;
use App\Models\WordPressConnection;

class EntitlementService
{
    public function __construct(private PlanCatalog $catalog, private UsageService $usage) {}

    public function currentPlan(Organization $org): string
    {
        $s = Subscription::where('organization_id', $org->id)->latest('current_period_end')->first();
        if (! $s) {
            return 'free';
        } $access = in_array($s->status, ['active', 'trialing'], true) || ($s->status === 'past_due' && $s->grace_ends_at?->isFuture()) || ($s->status === 'canceled' && ! $s->ended_at && $s->current_period_end?->isFuture());

        return $access ? $s->plan_key : 'free';
    }

    public function limitFor(Organization $org, string $metric): int
    {
        return (int) ($this->catalog->plan($this->currentPlan($org))['entitlements'][$metric] ?? 0);
    }

    public function remainingUsage(Organization $org, string $metric): int
    {
        return max(0, $this->limitFor($org, $metric) - $this->usage->used($org, $metric));
    }

    public function canStartGeneration(Organization $o, string $provider): bool
    {
        $p = $this->catalog->plan($this->currentPlan($o));

        return in_array($provider, $p['entitlements']['providers'], true) && $this->remainingUsage($o, 'generations') > 0;
    }

    public function canStartLiveDeployment(Organization $o): bool
    {
        return $this->remainingUsage($o, 'live_deployments') > 0;
    }

    public function canCreateProject(Organization $o): bool
    {
        return Project::where('organization_id', $o->id)->whereNotIn('status', ['archived', 'deleted'])->count() < $this->limitFor($o, 'projects');
    }

    public function canInviteMember(Organization $o): bool
    {
        return (bool) $this->catalog->plan($this->currentPlan($o))['entitlements']['invitations'] && $o->memberships()->where('status', 'active')->count() < $this->limitFor($o, 'members');
    }

    public function canCreateWordPressConnection(Organization $o): bool
    {
        return WordPressConnection::where('organization_id', $o->id)->count() < $this->limitFor($o, 'wordpress_connections');
    }

    public function denial(Organization $o, string $metric): array
    {
        $used = in_array($metric, ['generations', 'live_deployments']) ? $this->usage->used($o, $metric) : 0;
        $limit = $this->limitFor($o, $metric);

        return ['code' => 'billing_limit_exceeded', 'message' => 'Your plan limit has been reached.', 'metric' => $metric, 'limit' => $limit, 'used' => $used, 'remaining' => max(0, $limit - $used), 'current_plan' => $this->currentPlan($o), 'upgrade_required' => true];
    }
}
