<?php

namespace App\Http\Controllers;

use App\Models\MediaAsset;
use App\Models\Project;
use App\Services\MediaService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class MediaController extends Controller
{
    public function __construct(private MediaService $media) {}

    public function index(Request $request)
    {
        $query = MediaAsset::query()->where('organization_id', $request->user()->current_organization_id)->withCount('usages');
        $query->when($request->string('search')->toString(), fn ($q, $s) => $q->where(fn ($x) => $x->where('display_name', 'like', "%$s%")->orWhere('alt_text', 'like', "%$s%")->orWhere('description', 'like', "%$s%")));
        foreach (['project_id', 'status', 'source_type'] as $field) {
            $query->when($request->input($field), fn ($q, $value) => $q->where($field, $value));
        }

        return response()->json(['data' => $query->latest()->cursorPaginate(min((int) $request->input('per_page', 30), 100))->through(fn ($a) => $this->media->resource($a) + ['usage_count' => $a->usages_count])]);
    }

    public function initiate(Request $request)
    {
        $data = $request->validate(['filename' => 'required|string|max:255', 'mime_type' => 'required|string', 'size_bytes' => 'required|integer|min:1', 'display_name' => 'nullable|string|max:255', 'project_id' => 'nullable|uuid|exists:projects,id', 'source_type' => 'nullable|in:upload,logo,screenshot']);
        if (isset($data['project_id'])) {
            abort_unless(Project::where('organization_id', $request->user()->current_organization_id)->whereKey($data['project_id'])->exists(), 404);
        }
        [$asset, $upload] = $this->media->initiate($data, $request->user()->current_organization_id, $request->user()->id);

        return response()->json(['data' => ['asset' => $this->media->resource($asset), 'upload' => $upload]], 201);
    }

    public function complete(MediaAsset $mediaAsset)
    {
        return response()->json(['data' => $this->media->resource($this->media->complete($mediaAsset))]);
    }

    public function abort(MediaAsset $mediaAsset)
    {
        abort_unless($mediaAsset->status === 'pending_upload', 409);
        Storage::disk($mediaAsset->storage_disk)->delete($mediaAsset->storage_key);
        $mediaAsset->delete();

        return response()->noContent();
    }

    public function show(MediaAsset $mediaAsset)
    {
        return response()->json(['data' => $this->media->resource($mediaAsset)]);
    }

    public function update(Request $request, MediaAsset $mediaAsset)
    {
        $mediaAsset->update($request->validate(['display_name' => 'sometimes|string|max:255', 'description' => 'nullable|string|max:2000', 'alt_text' => 'nullable|string|max:1000', 'caption' => 'nullable|string|max:2000']));

        return response()->json(['data' => $this->media->resource($mediaAsset)]);
    }

    public function destroy(MediaAsset $mediaAsset)
    {
        abort_if($mediaAsset->usages()->whereHas('revision', fn ($q) => $q->where('status', 'approved'))->exists(), 409, 'Asset is used by an approved revision.');
        $mediaAsset->update(['status' => 'deleted']);
        $mediaAsset->delete();

        return response()->noContent();
    }

    public function restore(string $mediaAsset)
    {
        $asset = MediaAsset::withTrashed()->where('organization_id', request()->user()->current_organization_id)->findOrFail($mediaAsset);
        $asset->restore();
        $asset->update(['status' => 'ready']);

        return response()->json(['data' => $this->media->resource($asset)]);
    }

    public function variants(MediaAsset $mediaAsset)
    {
        return response()->json(['data' => $mediaAsset->variants()->get()->map(fn ($v) => $v->makeHidden(['storage_key', 'storage_disk']))]);
    }

    public function reprocess(MediaAsset $mediaAsset)
    {
        abort_unless(in_array($mediaAsset->status, ['ready', 'failed'], true), 409);
        $mediaAsset->update(['status' => 'processing', 'metadata' => array_merge($mediaAsset->metadata ?? [], ['processing' => ['stage' => 'verify_upload', 'progress' => 0]])]);

        return response()->json(['data' => $this->media->resource($mediaAsset)]);
    }
}
