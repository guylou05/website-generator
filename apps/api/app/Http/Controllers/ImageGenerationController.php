<?php

namespace App\Http\Controllers;

use App\Models\ImageGenerationJob;
use App\Models\MediaAsset;
use App\Models\Project;
use Illuminate\Http\Request;

class ImageGenerationController extends Controller
{
    private const RATIOS = ['1:1', '4:3', '3:2', '16:9', '9:16', '3:4'];

    private const STYLES = ['professional-photography', 'editorial', 'modern-business', 'clean-product', 'warm-local-business', 'luxury', 'minimal', 'technology', 'construction', 'healthcare', 'restaurant', 'salon', 'custom'];

    public function index(Project $project)
    {
        return response()->json(['data' => ImageGenerationJob::where('project_id', $project->id)->latest()->paginate(25)]);
    }

    public function store(Request $request, Project $project)
    {
        $data = $request->validate(['prompt' => 'required|string|min:3|max:4000', 'negative_prompt' => 'nullable|string|max:2000', 'style_preset' => 'nullable|in:'.implode(',', self::STYLES), 'aspect_ratio' => 'required|in:'.implode(',', self::RATIOS), 'count' => 'required|integer|min:1|max:4', 'input_asset_id' => 'nullable|uuid', 'website_revision_id' => 'nullable|uuid', 'target_page_id' => 'nullable|string|max:255', 'target_section_id' => 'nullable|string|max:255', 'target_field_path' => 'nullable|string|max:500']);
        if (! empty($data['input_asset_id'])) {
            abort_unless(MediaAsset::where('organization_id', $request->user()->current_organization_id)->whereKey($data['input_asset_id'])->where('status', 'ready')->exists(), 422, 'Reference image is unavailable.');
        }
        $job = ImageGenerationJob::create($data + ['organization_id' => $request->user()->current_organization_id, 'project_id' => $project->id, 'requested_by' => $request->user()->id, 'status' => 'queued', 'provider' => config('media.image_provider'), 'requested_count' => $data['count'], 'queued_at' => now()]);

        return response()->json(['data' => $job], 201);
    }

    public function show(ImageGenerationJob $imageGenerationJob)
    {
        return response()->json(['data' => $imageGenerationJob->load('results')]);
    }

    public function cancel(ImageGenerationJob $imageGenerationJob)
    {
        abort_unless(in_array($imageGenerationJob->status, ['queued', 'running'], true), 409);
        $imageGenerationJob->update(['status' => 'canceled', 'canceled_at' => now()]);

        return response()->json(['data' => $imageGenerationJob]);
    }

    public function retry(ImageGenerationJob $imageGenerationJob)
    {
        abort_unless(in_array($imageGenerationJob->status, ['failed', 'canceled'], true), 409);
        $imageGenerationJob->update(['status' => 'queued', 'error' => null, 'queued_at' => now(), 'canceled_at' => null]);

        return response()->json(['data' => $imageGenerationJob]);
    }
}
