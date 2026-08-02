<?php

namespace App\Http\Controllers;

use App\Http\Resources\GenerationSummaryResource;
use App\Models\Project;

class ProjectGenerationSummaryController extends Controller
{
    public function __invoke(Project $project): GenerationSummaryResource
    {
        return new GenerationSummaryResource($project->load([
            'latestRevision',
            'generationRuns' => fn ($query) => $query->latest()->limit(1),
        ]));
    }
}
