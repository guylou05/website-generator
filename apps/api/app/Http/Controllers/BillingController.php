<?php

namespace App\Http\Controllers;

use App\Models\Organization;
use App\Models\Subscription;
use App\Services\EntitlementService;
use App\Services\PlanCatalog;
use App\Services\SubscriptionService;
use App\Services\UsageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class BillingController extends Controller
{
    public function __construct(private PlanCatalog $plans, private EntitlementService $entitlements, private UsageService $usage, private SubscriptionService $subscriptions) {}

    private function org(Request $r): Organization
    {
        $o = Organization::findOrFail($r->user()->current_organization_id);
        $role = $r->user()->membershipFor($o->id)?->role;
        abort_unless(in_array($role, ['owner', 'admin'], true), 403, 'Only organization owners and admins may view or manage billing.');

        return $o;
    }

    public function plans(Request $r): JsonResponse
    {
        $this->org($r);

        return response()->json(['data' => $this->plans->publicPlans()]);
    }

    public function summary(Request $r): JsonResponse
    {
        $o = $this->org($r);
        $s = Subscription::where('organization_id', $o->id)->latest('current_period_end')->first();

        return response()->json(['data' => ['current_plan' => $this->entitlements->currentPlan($o), 'subscription' => $s, 'limits' => collect(['projects', 'members', 'wordpress_connections', 'generations', 'live_deployments'])->mapWithKeys(fn ($m) => [$m => $this->entitlements->limitFor($o, $m)])]]);
    }

    public function usage(Request $r): JsonResponse
    {
        $o = $this->org($r);
        [$start,$end] = $this->usage->period($o);
        $data = [];
        foreach (['generations', 'live_deployments'] as $m) {
            $data[$m] = ['used' => $this->usage->used($o, $m), 'limit' => $this->entitlements->limitFor($o, $m), 'remaining' => $this->entitlements->remainingUsage($o, $m)];
        }

return response()->json(['data' => ['period_start' => $start, 'period_end' => $end, 'metrics' => $data]]);
    }

    public function checkout(Request $r): JsonResponse
    {
        $o = $this->org($r);
        $d = $r->validate(['plan_key' => 'required|string', 'billing_interval' => 'required|in:monthly,yearly', 'success_url' => 'required|url', 'cancel_url' => 'required|url']);
        $this->safe($d['success_url']);
        $this->safe($d['cancel_url']);

        return response()->json(['data' => $this->subscriptions->checkout($o, $d['plan_key'], $d['billing_interval'], $d['success_url'], $d['cancel_url'])], 201);
    }

    public function portal(Request $r): JsonResponse
    {
        $o = $this->org($r);
        $d = $r->validate(['return_url' => 'required|url']);
        $this->safe($d['return_url']);

        return response()->json(['data' => $this->subscriptions->portal($o, $d['return_url'])], 201);
    }

    public function change(Request $r): JsonResponse
    {
        $o = $this->org($r);
        $d = $r->validate(['plan_key' => 'required|string', 'billing_interval' => 'required|in:monthly,yearly']);

        return response()->json(['data' => $this->subscriptions->mutate($o, 'change', $d['plan_key'], $d['billing_interval'])]);
    }

    public function cancel(Request $r): JsonResponse
    {
        return response()->json(['data' => $this->subscriptions->mutate($this->org($r), 'cancel')]);
    }

    public function resume(Request $r): JsonResponse
    {
        return response()->json(['data' => $this->subscriptions->mutate($this->org($r), 'resume')]);
    }

    private function safe(string $url): void
    {
        $parts = parse_url($url);
        $origin = ($parts['scheme'] ?? '').'://'.($parts['host'] ?? '').(isset($parts['port']) ? ':'.$parts['port'] : '');
        if (! in_array($origin, config('billing.dashboard_origins'), true)) {
            throw ValidationException::withMessages(['url' => ['Redirect origin is not allowed.']]);
        }
    }
}
