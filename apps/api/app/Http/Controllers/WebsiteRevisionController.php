<?php

namespace App\Http\Controllers;

use App\Models\Project;
use App\Models\WebsiteRevision;
use App\Services\WebsiteRevisionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class WebsiteRevisionController extends Controller
{
    public function __construct(private WebsiteRevisionService $service) {}

    public function index(Project $project): JsonResponse
    {
        return response()->json($project->websiteRevisions()->select(['id', 'project_id', 'revision_number', 'status', 'source', 'change_summary', 'created_by', 'approved_at', 'created_at', 'updated_at'])->latest('revision_number')->paginate(20));
    }

    public function store(Request $request, Project $project): JsonResponse
    {
        $this->edit($request);
        $data = $request->validate(['blueprint' => 'required|array', 'generation_run_id' => 'nullable|uuid']);

        return response()->json(['data' => $this->service->create($project, $data['blueprint'], 'manual_edit', null, $data['generation_run_id'] ?? null)], 201);
    }

    public function show(WebsiteRevision $revision): JsonResponse
    {
        return response()->json(['data' => $revision]);
    }

    public function clone(Request $request, WebsiteRevision $revision): JsonResponse
    {
        $this->edit($request);

        return response()->json(['data' => $this->service->clone($revision)], 201);
    }

    public function update(Request $request, WebsiteRevision $revision): JsonResponse
    {
        $this->edit($request);
        $data = $request->validate(['expected_updated_at' => 'required|string', 'operations' => 'required|array|min:1|max:50', 'operations.*.path' => 'required|string', 'operations.*.value' => 'present']);
        try {
            $saved = $this->service->patch($revision, $data['operations'], $data['expected_updated_at']);
        } catch (ValidationException $e) {
            if ($e->errors()['version'] ?? false) {
                return response()->json(['error' => ['code' => 'revision_conflict', 'message' => 'The revision changed on the server.'], 'latest' => $revision->fresh()], 409);
            }throw $e;
        }

return response()->json(['data' => $saved]);
    }

    public function validateRevision(Request $request, WebsiteRevision $revision): JsonResponse
    {
        $this->edit($request);

        return response()->json(['data' => $this->service->validate($revision)]);
    }

    public function approve(Request $request, WebsiteRevision $revision): JsonResponse
    {
        $this->manage($request);

        return response()->json(['data' => $this->service->approve($revision)]);
    }

    public function archive(Request $request, WebsiteRevision $revision): JsonResponse
    {
        $this->manage($request);
        if ($revision->status === 'approved') {
            abort(409, 'Approved revision cannot be archived.');
        } $revision->update(['status' => 'archived']);

        return response()->json(['data' => $revision]);
    }

    public function rollback(Request $request, WebsiteRevision $revision): JsonResponse
    {
        $this->manage($request);

        return response()->json(['data' => $this->service->clone($revision, 'rollback')], 201);
    }

    public function changes(WebsiteRevision $revision): JsonResponse
    {
        return response()->json(['data' => $revision->changes()->latest('created_at')->paginate(100)]);
    }

    public function compare(WebsiteRevision $revision, WebsiteRevision $otherRevision): JsonResponse
    {
        abort_unless($revision->project_id === $otherRevision->project_id, 404);
        $a = collect($revision->changes)->keyBy('field_path');
        $b = collect($otherRevision->changes)->keyBy('field_path');
        $paths = $a->keys()->merge($b->keys())->unique()->take(500);

        return response()->json(['data' => ['from' => $revision->id, 'to' => $otherRevision->id, 'changes' => $paths->map(fn ($p) => ['path' => $p, 'before' => $a->get($p)?->new_value, 'after' => $b->get($p)?->new_value, 'status' => $a->has($p) && $b->has($p) ? 'changed' : ($b->has($p) ? 'added' : 'removed')])->values()]]);
    }

    private function edit(Request $request): void
    {
        $role = $request->user()->memberships()->where('organization_id', $request->user()->current_organization_id)->value('role');
        abort_unless(in_array($role, ['owner', 'admin', 'member'], true), 403);
    }

    private function manage(Request $request): void
    {
        $role = $request->user()->memberships()->where('organization_id', $request->user()->current_organization_id)->value('role');
        abort_unless(in_array($role, ['owner', 'admin'], true), 403);
    }
}
