<?php

namespace App\Http\Controllers;

use App\Models\Organization;
use App\Models\OrganizationMembership;
use App\Models\User;
use App\Services\AuditService;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password as PasswordRule;

class AuthController extends Controller
{
    public function csrfToken(Request $request): JsonResponse
    {
        return response()
            ->json(['data' => ['token' => $request->session()->token()]])
            ->header('Cache-Control', 'no-store');
    }

    public function register(Request $request, AuditService $audit): JsonResponse
    {
        $data = $request->validate(['name' => 'required|string|max:255', 'email' => 'required|email|max:255|unique:users,email', 'password' => ['required', 'confirmed', PasswordRule::defaults()], 'organization_name' => 'nullable|string|max:255']);
        $user = DB::transaction(function () use ($data) {
            $user = User::create(['name' => $data['name'], 'email' => Str::lower($data['email']), 'password' => $data['password']]);
            $name = $data['organization_name'] ?? $data['name']."'s Organization";
            $organization = Organization::create(['name' => $name, 'slug' => Str::slug($name).'-'.Str::lower(Str::random(6)), 'owner_user_id' => $user->id]);
            OrganizationMembership::create(['organization_id' => $organization->id, 'user_id' => $user->id, 'role' => 'owner', 'status' => 'active', 'joined_at' => now()]);
            $user->forceFill(['current_organization_id' => $organization->id])->save();

            return $user;
        });
        event(new Registered($user));
        Auth::login($user);
        $request->session()->regenerate();
        $audit->record($request, 'registration', 'user', $user->id, [], $user->current_organization_id);

        return response()->json(['data' => $this->resource($user)], 201);
    }

    public function login(Request $request, AuditService $audit): JsonResponse
    {
        $data = $request->validate(['email' => 'required|email', 'password' => 'required|string']);
        if (! Auth::attempt(['email' => Str::lower($data['email']), 'password' => $data['password']], $request->boolean('remember'))) {
            $audit->record($request, 'login.failed', 'user', null, ['email_hash' => hash('sha256', Str::lower($data['email']))]);

            return response()->json(['error' => ['code' => 'invalid_credentials', 'message' => 'The supplied credentials are invalid.']], 422);
        } $request->session()->regenerate();
        $request->user()->forceFill(['last_login_at' => now()])->save();
        $audit->record($request, 'login.succeeded', 'user', $request->user()->id);

        return response()->json(['data' => $this->resource($request->user())]);
    }

    public function logout(Request $request, AuditService $audit): JsonResponse
    {
        $audit->record($request, 'logout', 'user', $request->user()->id);
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['data' => null]);
    }

    public function user(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->resource($request->user())]);
    }

    public function forgot(Request $request): JsonResponse
    {
        $request->validate(['email' => 'required|email']);
        Password::sendResetLink($request->only('email'));

        return response()->json(['data' => ['message' => 'If an account exists, a reset link has been sent.']]);
    }

    public function reset(Request $request): JsonResponse
    {
        $data = $request->validate(['token' => 'required', 'email' => 'required|email', 'password' => ['required', 'confirmed', PasswordRule::defaults()]]);
        $status = Password::reset($data, function (User $user, string $password) {
            $user->forceFill(['password' => Hash::make($password), 'remember_token' => Str::random(60)])->save();
        });

        return $status === Password::PASSWORD_RESET ? response()->json(['data' => ['message' => 'Password reset.']]) : response()->json(['error' => ['code' => 'reset_failed', 'message' => 'The password could not be reset.']], 422);
    }

    public function verification(Request $request): JsonResponse
    {
        if (! $request->user()->hasVerifiedEmail()) {
            $request->user()->sendEmailVerificationNotification();
        }

        return response()->json(['data' => ['message' => 'If verification is required, a link has been sent.']]);
    }

    public function verify(Request $request, string $id, string $hash): JsonResponse
    {
        $user = User::findOrFail($id);
        abort_unless(hash_equals(sha1($user->getEmailForVerification()), $hash), 403);
        if (! $user->hasVerifiedEmail()) {
            $user->markEmailAsVerified();
        }

        return response()->json(['data' => ['verified' => true]]);
    }

    private function resource(User $user): array
    {
        $user->load(['currentOrganization', 'memberships']);
        $membership = $user->current_organization_id ? $user->membershipFor($user->current_organization_id) : null;

        return ['id' => $user->id, 'name' => $user->name, 'email' => $user->email, 'email_verified_at' => $user->email_verified_at, 'current_organization' => $user->currentOrganization, 'current_role' => $membership?->role];
    }
}
