<?php

namespace App\Http\Controllers;

use App\Models\DeploymentPlan;
use App\Models\Project;
use App\Models\WebsiteRevision;
use App\Models\WordPressConnection;
use App\Services\DeploymentPlanService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class DeploymentPlanController extends Controller
{
    public function index(Project $project): JsonResponse
    {
        return response()->json(['data' => DeploymentPlan::where('project_id', $project->id)->latest()->get()]);
    }

    public function show(DeploymentPlan $deploymentPlan): JsonResponse
    {
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

    public function store(Request $request, Project $project, DeploymentPlanService $service): JsonResponse
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
        $plan = DeploymentPlan::create($result + ['organization_id' => $project->organization_id, 'project_id' => $project->id, 'website_revision_id' => $revision->id, 'wordpress_connection_id' => $connection->id, 'status' => 'ready', 'snapshot' => $snapshot, 'created_by' => $request->user()?->id]);

        return response()->json(['data' => $plan], 201);
    }
}
