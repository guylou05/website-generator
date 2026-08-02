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
        $request->merge([
            'authentication_type' => $request->input('authentication_type', 'application_password'),
        ]);

        $data = $request->validate([
            'name' => 'sometimes|string|max:255', 'site_url' => 'required|string|max:2048',
            'authentication_type' => 'required|in:connector,application_password',
            'username' => 'required_if:authentication_type,application_password|prohibited_if:authentication_type,connector|string|max:255',
            'application_password' => 'required_if:authentication_type,application_password|prohibited_if:authentication_type,connector|string|max:512',
            'connector_token' => 'required_if:authentication_type,connector|prohibited_if:authentication_type,application_password|string|max:2048',
        ]);
        try {
            $data['site_url'] = $service->normalize($data['site_url']);
        } catch (InvalidArgumentException $e) {
            return response()->json(['error' => ['code' => 'invalid_site_url', 'message' => $e->getMessage()]], 422);
        }
        $data['name'] ??= (string) parse_url($data['site_url'], PHP_URL_HOST);
        $connection = $project->wordpressConnections()->create([
            'organization_id' => $project->organization_id, 'created_by' => $request->user()?->id,
            'name' => $data['name'], 'site_url' => $data['site_url'], 'authentication_type' => $data['authentication_type'],
            'username' => $data['username'] ?? null, 'encrypted_application_password' => $data['application_password'] ?? null,
            'encrypted_connector_token' => $data['connector_token'] ?? null,
        ]);

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

    public function test(Request $request, Project $project, WordPressConnectionService $service): JsonResponse
    {
        $data = $request->validate(['connection_id' => 'required|uuid']);
        $connection = $project->wordpressConnections()->findOrFail($data['connection_id']);
        try {
            return response()->json($service->verify($connection));
        } catch (\RuntimeException $e) {
            return response()->json(['connected' => false, 'error' => ['code' => 'connection_verification_failed', 'message' => $e->getMessage()]], 422);
        }
    }
}
