<?php

namespace App\Http\Controllers;

use App\Models\Organization;
use App\Models\Project;
use App\Models\WordPressConnection;
use App\Services\EntitlementService;
use App\Services\WordPressConnectionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use InvalidArgumentException;

class WordPressConnectionController extends Controller
{
    public function index(Project $project): JsonResponse
    {
        return response()->json(['data' => $project->wordpressConnections()->latest()->get()]);
    }

    public function show(WordPressConnection $connection): JsonResponse
    {
        return response()->json(['data' => $connection]);
    }

    public function store(Request $request, Project $project, WordPressConnectionService $service, EntitlementService $entitlements): JsonResponse
    {
        $organization = Organization::findOrFail($project->organization_id);
        if (config('billing.enforcement') && ! $entitlements->canCreateWordPressConnection($organization)) {
            return response()->json(['error' => $entitlements->denial($organization, 'wordpress_connections')], 402);
        }
        $data = $request->validate(['site_url' => 'required|string|max:2048', 'username' => 'required|string|max:255', 'application_password' => 'required|string|max:512']);
        try {
            $data['site_url'] = $service->normalize($data['site_url']);
        } catch (InvalidArgumentException $e) {
            return response()->json(['error' => ['code' => 'invalid_site_url', 'message' => $e->getMessage()]], 422);
        }
        $connection = $project->wordpressConnections()->create(['organization_id' => $project->organization_id, 'site_url' => $data['site_url'], 'username' => $data['username'], 'encrypted_application_password' => $data['application_password']]);

        return response()->json(['data' => $connection], 201);
    }

    public function update(Request $request, WordPressConnection $connection, WordPressConnectionService $service): JsonResponse
    {
        $data = $request->validate(['site_url' => 'sometimes|string|max:2048', 'username' => 'sometimes|string|max:255', 'application_password' => 'sometimes|string|max:512']);
        try {
            if (isset($data['site_url'])) {
                $data['site_url'] = $service->normalize($data['site_url']);
            }
        } catch (InvalidArgumentException $e) {
            return response()->json(['error' => ['code' => 'invalid_site_url', 'message' => $e->getMessage()]], 422);
        }
        if (isset($data['application_password'])) {
            $data['encrypted_application_password'] = $data['application_password'];
            unset($data['application_password']);
        } $connection->update($data + ['status' => 'unverified', 'last_verified_at' => null]);

        return response()->json(['data' => $connection->fresh()]);
    }

    public function destroy(WordPressConnection $connection): JsonResponse
    {
        $connection->delete();

        return response()->json(null, 204);
    }

    public function verify(WordPressConnection $connection, WordPressConnectionService $service): JsonResponse
    {
        try {
            $service->verify($connection);

            return response()->json(['data' => $connection->fresh()]);
        } catch (\RuntimeException $e) {
            return response()->json(['error' => ['code' => 'connection_verification_failed', 'message' => $e->getMessage()]], 422);
        }
    }
}
