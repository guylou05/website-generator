<?php

namespace App\Http\Controllers;

use App\Models\PreviewSession;
use App\Models\WebsiteRevision;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class PreviewSessionController extends Controller
{
    public function index(WebsiteRevision $revision): JsonResponse
    {
        return response()->json(['data' => PreviewSession::where('website_revision_id', $revision->id)->latest('created_at')->get()]);
    }

    public function store(Request $request, WebsiteRevision $revision): JsonResponse
    {
        $token = Str::random(64);
        $session = PreviewSession::create(['organization_id' => $revision->organization_id, 'project_id' => $revision->project_id, 'website_revision_id' => $revision->id, 'token_hash' => hash('sha256', $token), 'expires_at' => now()->addDays(7), 'created_by' => $request->user()->id, 'created_at' => now()]);

        return response()->json(['data' => $session, 'token' => $token], 201);
    }

    public function destroy(PreviewSession $previewSession): JsonResponse
    {
        $previewSession->update(['revoked_at' => now()]);

        return response()->json(null, 204);
    }

    public function public(string $token): JsonResponse
    {
        $session = PreviewSession::withoutGlobalScopes()->where('token_hash', hash('sha256', $token))->firstOrFail();
        abort_if($session->revoked_at || $session->expires_at->isPast(), 410);
        $revision = WebsiteRevision::withoutGlobalScopes()->findOrFail($session->website_revision_id);

        return response()->json(['data' => ['revision_id' => $revision->id, 'revision_number' => $revision->revision_number, 'blueprint' => $revision->blueprint]], 200, ['X-Robots-Tag' => 'noindex, nofollow, noarchive']);
    }
}
