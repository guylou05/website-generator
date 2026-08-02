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
    public function index(Project $project): JsonResponse { return response()->json(['data' => DeploymentPlan::where('project_id', $project->id)->latest()->get()]); }
    public function show(DeploymentPlan $deploymentPlan): JsonResponse { return response()->json(['data' => $deploymentPlan]); }
    public function store(Request $request, Project $project, DeploymentPlanService $service): JsonResponse
    {
        $data = $request->validate(['website_revision_id' => 'nullable|uuid', 'wordpress_connection_id' => 'required|uuid']);
        $revision = isset($data['website_revision_id']) ? WebsiteRevision::where('project_id', $project->id)->findOrFail($data['website_revision_id']) : $project->approvedRevision;
        if (! $revision) return response()->json(['error' => ['code' => 'revision_required', 'message' => 'Select a website revision to compare.']], 409);
        $connection = WordPressConnection::where('organization_id', $project->organization_id)->findOrFail($data['wordpress_connection_id']);
        if ($connection->status !== 'verified') return response()->json(['error' => ['code' => 'connection_not_verified', 'message' => 'Verify the WordPress connection before creating a plan.']], 409);
        try { $snapshot = $service->snapshot($connection); } catch (RuntimeException $error) { return response()->json(['error' => ['code' => 'snapshot_failed', 'message' => $error->getMessage()]], 422); }
        $documents = $revision->elementor_output['documents'] ?? $revision->elementor_output ?? [];
        if (array_is_list($documents)) $documents = collect($documents)->mapWithKeys(fn ($document) => [($document['page'] ?? '') => ($document['elements'] ?? $document)])->all();
        $result = $service->compare($revision->blueprint ?? [], $documents, $snapshot);
        $plan = DeploymentPlan::create($result + ['organization_id' => $project->organization_id, 'project_id' => $project->id, 'website_revision_id' => $revision->id, 'wordpress_connection_id' => $connection->id, 'status' => 'ready', 'snapshot' => $snapshot, 'created_by' => $request->user()?->id]);
        return response()->json(['data' => $plan], 201);
    }
}
