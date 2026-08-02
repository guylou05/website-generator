<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Deployment;
use App\Models\GenerationRun;
use App\Models\MediaAsset;
use App\Models\Organization;
use App\Models\Project;
use App\Services\EntitlementService;
use App\Services\UsageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class DashboardOverviewController extends Controller
{
    public function __invoke(Request $request, EntitlementService $entitlements, UsageService $usage): JsonResponse
    {
        $user = $request->user();
        $organization = Organization::findOrFail($user->current_organization_id);
        $membership = $user->membershipFor($organization->id);
        abort_unless($membership, 403);
        $organizationId = $organization->id;
        $month = now()->startOfMonth();

        $projectCounts = Project::where('organization_id', $organizationId)
            ->selectRaw("count(*) as total, sum(case when status in ('live','ready','published') then 1 else 0 end) as live, sum(case when status = 'draft' then 1 else 0 end) as draft, sum(case when status = 'paused' then 1 else 0 end) as paused, sum(case when status = 'failed' then 1 else 0 end) as failed")
            ->first();
        $generation = GenerationRun::where('organization_id', $organizationId)->where('created_at', '>=', $month)
            ->selectRaw('count(*) as total, avg(case when completed_at is not null and started_at is not null then '.(config('database.default') === 'pgsql' ? 'extract(epoch from (completed_at - started_at))' : "strftime('%s', completed_at) - strftime('%s', started_at)").' end) as average_seconds')->first();
        $deployment = Deployment::where('organization_id', $organizationId)->where('created_at', '>=', $month)
            ->selectRaw("count(*) as total, sum(case when status = 'succeeded' then 1 else 0 end) as succeeded, sum(case when status in ('succeeded','failed') then 1 else 0 end) as finished")->first();

        $projects = Project::where('organization_id', $organizationId)->with([
            'generationRuns' => fn ($query) => $query->latest()->limit(1)->select('id', 'project_id', 'status'),
            'deployments' => fn ($query) => $query->latest()->limit(1)->select('id', 'project_id', 'status'),
        ])->latest('updated_at')->limit(5)->get();
        $deployments = Deployment::where('deployments.organization_id', $organizationId)->with('connection:id,site_url')
            ->join('projects', 'projects.id', '=', 'deployments.project_id')
            ->select('deployments.*', 'projects.name as project_name')->latest('deployments.created_at')->limit(5)->get();
        $activity = AuditLog::where('organization_id', $organizationId)->latest('created_at')->limit(10)->get();

        $generationLimit = $entitlements->limitFor($organization, 'generations');
        $deploymentLimit = $entitlements->limitFor($organization, 'live_deployments');
        $finished = (int) ($deployment->finished ?? 0);

        return response()->json(['data' => [
            'user' => ['id' => $user->id, 'name' => $user->name, 'first_name' => $user->first_name ?: str($user->name)->before(' ')->toString(), 'email' => $user->email, 'email_verified_at' => $user->email_verified_at],
            'organization' => ['id' => $organizationId, 'name' => $organization->name, 'slug' => $organization->slug, 'role' => $membership->role, 'plan' => $entitlements->currentPlan($organization)],
            'metrics' => ['total_projects' => (int) $projectCounts->total, 'live_websites' => (int) $projectCounts->live, 'draft_websites' => (int) $projectCounts->draft, 'paused_websites' => (int) $projectCounts->paused, 'failed_websites' => (int) $projectCounts->failed, 'generations_this_month' => (int) $generation->total, 'deployments_this_month' => (int) $deployment->total, 'average_generation_seconds' => $generation->average_seconds === null ? null : (int) round($generation->average_seconds), 'deployment_success_rate' => $finished ? round(((int) $deployment->succeeded / $finished) * 100, 1) : null, 'media_storage_bytes' => (int) MediaAsset::where('organization_id', $organizationId)->sum('size_bytes'), 'generation_usage' => $usage->used($organization, 'generations'), 'generation_limit' => $generationLimit, 'deployment_usage' => $usage->used($organization, 'live_deployments'), 'deployment_limit' => $deploymentLimit],
            'recent_projects' => $projects->map(fn ($project) => ['id' => $project->id, 'name' => $project->name, 'slug' => $project->slug, 'status' => $project->status, 'updated_at' => $project->updated_at, 'approved_revision_id' => $project->approved_revision_id, 'last_generation' => $project->generationRuns->first()?->status, 'last_deployment' => $project->deployments->first()?->status]),
            'recent_deployments' => $deployments->map(fn ($item) => ['id' => $item->id, 'project_id' => $item->project_id, 'project_name' => $item->project_name, 'status' => $item->status, 'dry_run' => $item->dry_run, 'completed_at' => $item->completed_at, 'site_url' => $item->wordpressConnection?->site_url]),
            'recent_activity' => $activity->map(fn ($item) => ['id' => $item->id, 'action' => $item->action, 'description' => data_get($item->metadata, 'description', str($item->action)->replace('.', ' ')->headline()), 'created_at' => $item->created_at, 'project_id' => $item->auditable_type === 'project' ? $item->auditable_id : null]),
            'system' => ['worker_available' => Cache::has('worker:heartbeat'), 'scheduler_available' => Cache::has('scheduler:heartbeat'), 'queue_status' => config('queue.default') === 'sync' ? 'synchronous' : (Cache::has('worker:heartbeat') ? 'available' : 'unknown')],
        ]]);
    }
}
