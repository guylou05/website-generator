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
    public function index(Request $request): JsonResponse
    {
        $connections = WordPressConnection::where('organization_id', $request->user()->current_organization_id)
            ->withMax('deployments', 'completed_at')->latest()->get();

        return response()->json(['data' => $connections]);
    }

    public function projectIndex(Request $request, Project $project): JsonResponse
    {
        return $this->index($request);
    }

    public function show(WordPressConnection $connection): JsonResponse
    {
        return response()->json(['data' => $connection->loadMax('deployments', 'completed_at')]);
    }

    public function store(Request $request, WordPressConnectionService $service, EntitlementService $entitlements): JsonResponse
    {
        $organization = Organization::findOrFail($request->user()->current_organization_id);
        if (config('billing.enforcement') && ! $entitlements->canCreateWordPressConnection($organization)) {
            return response()->json(['error' => $entitlements->denial($organization, 'wordpress_connections')], 402);
        }
        $data = $this->credentials($request, true);
        try {
            $data['site_url'] = $service->normalize($data['site_url']);
        } catch (InvalidArgumentException $e) {
            return response()->json(['error' => ['code' => 'invalid_site_url', 'message' => $e->getMessage()]], 422);
        }
        $data['name'] ??= (string) parse_url($data['site_url'], PHP_URL_HOST);
        $connection = WordPressConnection::create($this->attributes($data) + [
            'organization_id' => $organization->id,
            'created_by' => $request->user()->id,
        ]);

        return response()->json(['data' => $connection], 201);
    }

    /** Backwards-compatible project route; the record is still organization owned. */
    public function projectStore(Request $request, Project $project, WordPressConnectionService $service, EntitlementService $entitlements): JsonResponse
    {
        return $this->store($request, $service, $entitlements);
    }

    public function update(Request $request, WordPressConnection $connection, WordPressConnectionService $service): JsonResponse
    {
        $data = $this->credentials($request, false, $connection->authentication_type);
        try {
            if (isset($data['site_url'])) {
                $data['site_url'] = $service->normalize($data['site_url']);
            }
        } catch (InvalidArgumentException $e) {
            return response()->json(['error' => ['code' => 'invalid_site_url', 'message' => $e->getMessage()]], 422);
        }
        $connection->update($this->attributes($data) + ['status' => 'unverified', 'last_verified_at' => null]);

        return response()->json(['data' => $connection->fresh()]);
    }

    public function destroy(WordPressConnection $connection): JsonResponse
    {
        if ($connection->deployments()->exists()) {
            return response()->json(['error' => ['code' => 'connection_in_use', 'message' => 'This connection has deployment history and cannot be deleted.']], 409);
        }
        Project::where('default_wordpress_connection_id', $connection->id)->update(['default_wordpress_connection_id' => null]);
        $connection->delete();

        return response()->json(null, 204);
    }

    public function test(WordPressConnection $connection, WordPressConnectionService $service): JsonResponse
    {
        try {
            $service->verify($connection);

            return response()->json(['data' => $connection->fresh()]);
        } catch (\RuntimeException $e) {
            return response()->json(['error' => ['code' => 'connection_verification_failed', 'message' => $e->getMessage()]], 422);
        }
    }

    public function rotateToken(Request $request, WordPressConnection $connection): JsonResponse
    {
        if ($connection->authentication_type !== 'connector') {
            return response()->json(['error' => ['code' => 'wrong_authentication_type', 'message' => 'Only connector tokens can be rotated.']], 409);
        }
        $data = $request->validate(['connector_token' => 'required|string|max:2048']);
        $connection->update(['encrypted_connector_token' => $data['connector_token'], 'status' => 'unverified', 'last_verified_at' => null]);

        return response()->json(['data' => $connection->fresh()]);
    }

    private function credentials(Request $request, bool $creating, ?string $currentType = null): array
    {
        if ($creating) {
            $request->merge(['authentication_type' => $request->input('authentication_type', 'application_password')]);
        }
        $type = $request->input('authentication_type', $currentType);
        $rules = [
            'name' => ($creating ? 'sometimes' : 'sometimes').'|string|max:255',
            'site_url' => ($creating ? 'required' : 'sometimes').'|string|max:2048',
            'authentication_type' => ($creating ? 'required' : 'sometimes').'|in:connector,application_password',
            'username' => 'nullable|string|max:255', 'application_password' => 'nullable|string|max:512',
            'connector_token' => 'nullable|string|max:2048',
        ];
        if ($creating || $request->has('authentication_type')) {
            $rules['username'] = $type === 'application_password' ? 'required|string|max:255' : 'prohibited';
            $rules['application_password'] = $type === 'application_password' ? 'required|string|max:512' : 'prohibited';
            $rules['connector_token'] = $type === 'connector' ? 'required|string|max:2048' : 'prohibited';
        }

        return $request->validate($rules);
    }

    private function attributes(array $data): array
    {
        if (array_key_exists('application_password', $data)) {
            $data['encrypted_application_password'] = $data['application_password'];
            unset($data['application_password']);
        }
        if (array_key_exists('connector_token', $data)) {
            $data['encrypted_connector_token'] = $data['connector_token'];
            unset($data['connector_token']);
        }

        return $data;
    }
}
