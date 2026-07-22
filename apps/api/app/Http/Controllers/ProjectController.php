<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreProjectRequest;
use App\Http\Requests\UpdateProjectRequest;
use App\Http\Resources\ProjectResource;
use App\Models\Project;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Str;

class ProjectController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return ProjectResource::collection(Project::where('organization_id', request()->user()->current_organization_id)->with(['generationRuns' => fn ($query) => $query->latest()->limit(1)])->latest()->get());
    }

    public function store(StoreProjectRequest $request): ProjectResource
    {
        $data = $request->validated();
        $data['organization_id'] = $request->user()->current_organization_id;
        $data['slug'] ??= Str::slug($data['name']).'-'.Str::lower(Str::random(6));

        return new ProjectResource(Project::create($data));
    }

    public function show(Project $project): ProjectResource
    {
        return new ProjectResource($project->load(['generationRuns' => fn ($query) => $query->latest(), 'generationRuns.events']));
    }

    public function update(UpdateProjectRequest $request, Project $project): ProjectResource
    {
        $project->update($request->validated());

        return new ProjectResource($project->fresh());
    }

    public function destroy(Project $project): Response
    {
        $project->delete();

        return response()->noContent();
    }
}
