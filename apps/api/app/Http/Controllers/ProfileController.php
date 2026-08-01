<?php

namespace App\Http\Controllers;

use App\Models\MediaAsset;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class ProfileController extends Controller
{
    private const NOTIFICATIONS = ['generation_completed', 'generation_failed', 'deployment_completed', 'deployment_failed', 'billing_notices', 'security_notices'];

    public function show(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->resource($request)]);
    }

    public function update(Request $request, AuditService $audit): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate(['first_name' => 'nullable|string|max:100', 'last_name' => 'nullable|string|max:100', 'email' => ['sometimes', 'email', 'max:255', Rule::unique('users')->ignore($user->id)], 'current_password' => 'nullable|string', 'timezone' => 'nullable|timezone', 'locale' => 'nullable|string|max:16', 'appearance' => 'nullable|in:light,dark,system', 'notification_preferences' => 'nullable|array', 'notification_preferences.*' => 'boolean']);
        if (isset($data['notification_preferences'])) {
            $data['notification_preferences'] = array_intersect_key($data['notification_preferences'], array_flip(self::NOTIFICATIONS));
            $data['notification_preferences']['security_notices'] = true;
        }
        if (isset($data['email']) && Str::lower($data['email']) !== $user->email) {
            if (! Hash::check((string) ($data['current_password'] ?? ''), $user->password)) {
                throw ValidationException::withMessages(['current_password' => ['The password is incorrect.']]);
            }
            $data['email'] = Str::lower($data['email']);
            $data['email_verified_at'] = null;
        }
        unset($data['current_password']);
        if (array_key_exists('first_name', $data) || array_key_exists('last_name', $data)) {
            $data['name'] = trim(($data['first_name'] ?? $user->first_name ?? '').' '.($data['last_name'] ?? $user->last_name ?? '')) ?: $user->name;
        }
        $user->forceFill($data)->save();
        $audit->record($request, 'profile.updated', 'user', $user->id);

        return response()->json(['data' => $this->resource($request)]);
    }

    public function avatar(Request $request, AuditService $audit): JsonResponse
    {
        $data = $request->validate(['media_asset_id' => 'required|uuid']);
        $asset = MediaAsset::where('organization_id', $request->user()->current_organization_id)->where('status', 'ready')->where('mime_type', 'like', 'image/%')->findOrFail($data['media_asset_id']);
        $request->user()->update(['avatar_media_asset_id' => $asset->id]);
        $audit->record($request, 'profile.avatar_updated', 'user', $request->user()->id);

        return response()->json(['data' => $this->resource($request)]);
    }

    public function removeAvatar(Request $request, AuditService $audit): JsonResponse
    {
        $request->user()->update(['avatar_media_asset_id' => null]);
        $audit->record($request, 'profile.avatar_removed', 'user', $request->user()->id);

        return response()->json(['data' => $this->resource($request)]);
    }

    public function password(Request $request, AuditService $audit): JsonResponse
    {
        $data = $request->validate(['current_password' => 'required|string', 'password' => ['required', 'confirmed', Password::defaults()]]);
        if (! Hash::check($data['current_password'], $request->user()->password)) {
            throw ValidationException::withMessages(['current_password' => ['The password is incorrect.']]);
        }
        $request->user()->forceFill(['password' => $data['password'], 'remember_token' => Str::random(60)])->save();
        $audit->record($request, 'password.changed', 'user', $request->user()->id);

        return response()->json(['data' => ['message' => 'Password changed.']]);
    }

    public function sessions(Request $request): JsonResponse
    {
        if (config('session.driver') !== 'database' || ! DB::getSchemaBuilder()->hasTable(config('session.table', 'sessions'))) {
            return response()->json(['data' => []]);
        }

        return response()->json(['data' => DB::table(config('session.table', 'sessions'))->where('user_id', $request->user()->id)->latest('last_activity')->get()->map(fn ($session) => ['id' => $session->id, 'ip_address' => $session->ip_address, 'user_agent' => $session->user_agent, 'last_activity' => $session->last_activity, 'current' => hash_equals($request->session()->getId(), $session->id)])]);
    }

    public function revokeSession(Request $request, string $session, AuditService $audit): JsonResponse
    {
        abort_unless(config('session.driver') === 'database', 501, 'Session revocation is not supported by the configured session driver.');
        DB::table(config('session.table', 'sessions'))->where('user_id', $request->user()->id)->where('id', $session)->delete();
        $audit->record($request, 'session.revoked', 'user', $request->user()->id);

        return response()->json(['data' => null]);
    }

    public function revokeOthers(Request $request, AuditService $audit): JsonResponse
    {
        abort_unless(config('session.driver') === 'database', 501, 'Session revocation is not supported by the configured session driver.');
        DB::table(config('session.table', 'sessions'))->where('user_id', $request->user()->id)->where('id', '!=', $request->session()->getId())->delete();
        $audit->record($request, 'sessions.others_revoked', 'user', $request->user()->id);

        return response()->json(['data' => null]);
    }

    private function resource(Request $request): array
    {
        $user = $request->user();
        $asset = $user->avatar_media_asset_id ? MediaAsset::where('organization_id', $user->current_organization_id)->find($user->avatar_media_asset_id) : null;

        return ['id' => $user->id, 'name' => $user->name, 'first_name' => $user->first_name, 'last_name' => $user->last_name, 'email' => $user->email, 'email_verified_at' => $user->email_verified_at, 'avatar' => $asset ? ['id' => $asset->id, 'url' => $asset->url ?? null] : null, 'timezone' => $user->timezone, 'locale' => $user->locale, 'appearance' => $user->appearance, 'notification_preferences' => array_merge(array_fill_keys(self::NOTIFICATIONS, true), $user->notification_preferences ?? []), 'last_login_at' => $user->last_login_at];
    }
}
