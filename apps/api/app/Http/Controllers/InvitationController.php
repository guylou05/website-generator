<?php

namespace App\Http\Controllers;

use App\Models\Organization;
use App\Models\OrganizationInvitation;
use App\Models\OrganizationMembership;
use App\Services\AuditService;
use App\Services\EntitlementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class InvitationController extends Controller
{
    public function index(Request $r, Organization $organization): JsonResponse
    {
        $this->authorize('manage', $organization);

        return response()->json(['data' => $organization->invitations()->whereNull('accepted_at')->whereNull('revoked_at')->get()]);
    }

    public function store(Request $r, Organization $organization, AuditService $audit, EntitlementService $entitlements): JsonResponse
    {
        $this->authorize('manage', $organization);
        if (config('billing.enforcement') && ! $entitlements->canInviteMember($organization)) {
            return response()->json(['error' => $entitlements->denial($organization, 'members')], 402);
        }
        $d = $r->validate(['email' => 'required|email|max:255', 'role' => 'required|in:admin,member,viewer']);
        $email = Str::lower($d['email']);
        $organization->invitations()->where('email', $email)->whereNull('accepted_at')->whereNull('revoked_at')->update(['revoked_at' => now()]);
        $token = Str::random(64);
        $invitation = OrganizationInvitation::create(['organization_id' => $organization->id, 'email' => $email, 'role' => $d['role'], 'token_hash' => hash('sha256', $token), 'invited_by' => $r->user()->id, 'expires_at' => now()->addDays(7)]);
        $url = rtrim(config('app.dashboard_url', 'http://localhost:3000'), '/').'/invitations/'.$token;
        Mail::raw("You have been invited to {$organization->name}: {$url}", fn ($m) => $m->to($email)->subject('Organization invitation'));
        $audit->record($r, 'invitation.created', 'invitation', $invitation->id, ['email_hash' => hash('sha256', $email)]);

        return response()->json(['data' => array_merge($invitation->toArray(), ['invitation_url' => $url])], 201);
    }

    public function accept(Request $r, string $token, AuditService $audit): JsonResponse
    {
        $invitation = OrganizationInvitation::where('token_hash', hash('sha256', $token))->firstOrFail();
        abort_if($invitation->accepted_at || $invitation->revoked_at || $invitation->expires_at->isPast(), 410, 'Invitation is no longer valid.');
        abort_unless(hash_equals(Str::lower($r->user()->email), Str::lower($invitation->email)), 403);
        DB::transaction(function () use ($invitation, $r) {
            OrganizationMembership::updateOrCreate(['organization_id' => $invitation->organization_id, 'user_id' => $r->user()->id], ['role' => $invitation->role, 'status' => 'active', 'invited_by' => $invitation->invited_by, 'joined_at' => now()]);
            $invitation->update(['accepted_at' => now()]);
            if (! $r->user()->current_organization_id) {
                $r->user()->update(['current_organization_id' => $invitation->organization_id]);
            }
        });
        $audit->record($r, 'invitation.accepted', 'invitation', $invitation->id);

        return response()->json(['data' => ['accepted' => true]]);
    }

    public function destroy(Request $r, Organization $organization, OrganizationInvitation $invitation, AuditService $audit): JsonResponse
    {
        $this->authorize('manage', $organization);
        abort_unless($invitation->organization_id === $organization->id, 404);
        $invitation->update(['revoked_at' => now()]);
        $audit->record($r, 'invitation.revoked', 'invitation', $invitation->id);

        return response()->json(['data' => null]);
    }
}
