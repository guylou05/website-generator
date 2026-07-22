<?php

namespace App\Http\Controllers;

use App\Models\Organization;
use App\Models\OrganizationMembership;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class OrganizationController extends Controller
{
    public function index(Request $r): JsonResponse
    {
        return response()->json(['data' => Organization::whereHas('memberships', fn ($q) => $q->where('user_id', $r->user()->id)->where('status', 'active'))->with(['memberships' => fn ($q) => $q->where('user_id', $r->user()->id)])->get()]);
    }

    public function store(Request $r, AuditService $audit): JsonResponse
    {
        $d = $r->validate(['name' => 'required|string|max:255']);
        $o = DB::transaction(function () use ($r, $d) {
            $o = Organization::create(['name' => $d['name'], 'slug' => Str::slug($d['name']).'-'.Str::lower(Str::random(6)), 'owner_user_id' => $r->user()->id]);
            OrganizationMembership::create(['organization_id' => $o->id, 'user_id' => $r->user()->id, 'role' => 'owner', 'status' => 'active', 'joined_at' => now()]);

            return $o;
        });
        $audit->record($r, 'organization.created', 'organization', $o->id, [], $o->id);

        return response()->json(['data' => $o], 201);
    }

    public function show(Request $r, Organization $organization): JsonResponse
    {
        $this->authorize('view', $organization);

        return response()->json(['data' => $organization]);
    }

    public function update(Request $r, Organization $organization, AuditService $audit): JsonResponse
    {
        $this->authorize('manage', $organization);
        $organization->update($r->validate(['name' => 'required|string|max:255']));
        $audit->record($r, 'organization.updated', 'organization', $organization->id);

        return response()->json(['data' => $organization]);
    }

    public function destroy(Request $r, Organization $organization, AuditService $audit): JsonResponse
    {
        $this->authorize('own', $organization);
        $r->validate(['password' => 'required']);
        abort_unless(Hash::check($r->string('password'), $r->user()->password), 422, 'Password confirmation failed.');
        $audit->record($r, 'organization.deleted', 'organization', $organization->id);
        $organization->delete();

        return response()->json(['data' => null]);
    }

    public function switch(Request $r, Organization $organization, AuditService $audit): JsonResponse
    {
        $this->authorize('view', $organization);
        $r->user()->forceFill(['current_organization_id' => $organization->id])->save();
        $audit->record($r, 'organization.switched', 'organization', $organization->id);

        return response()->json(['data' => $organization]);
    }

    public function members(Request $r, Organization $organization): JsonResponse
    {
        $this->authorize('view', $organization);

        return response()->json(['data' => $organization->memberships()->with('user:id,name,email')->get()]);
    }

    public function updateMember(Request $r, Organization $organization, OrganizationMembership $membership, AuditService $audit): JsonResponse
    {
        $this->authorize('manage', $organization);
        abort_unless($membership->organization_id === $organization->id, 404);
        $d = $r->validate(['role' => 'required|in:admin,member,viewer']);
        abort_if($membership->role === 'owner', 422, 'Transfer ownership first.');
        $membership->update($d);
        $audit->record($r, 'membership.role_changed', 'membership', $membership->id);

        return response()->json(['data' => $membership]);
    }

    public function removeMember(Request $r, Organization $organization, OrganizationMembership $membership, AuditService $audit): JsonResponse
    {
        $this->authorize('manage', $organization);
        abort_unless($membership->organization_id === $organization->id, 404);
        abort_if($membership->role === 'owner', 422, 'Transfer ownership first.');
        $membership->delete();
        $audit->record($r, 'membership.removed', 'membership', $membership->id);

        return response()->json(['data' => null]);
    }

    public function transfer(Request $r, Organization $organization, AuditService $audit): JsonResponse
    {
        $this->authorize('own', $organization);
        $d = $r->validate(['user_id' => 'required|uuid']);
        $next = $organization->memberships()->where('user_id', $d['user_id'])->where('status', 'active')->firstOrFail();
        DB::transaction(function () use ($organization, $next, $r) {
            $organization->memberships()->where('user_id', $r->user()->id)->update(['role' => 'admin']);
            $next->update(['role' => 'owner']);
            $organization->update(['owner_user_id' => $next->user_id]);
        });
        $audit->record($r,'ownership.transferred','organization',$organization->id,['new_owner_id' => $next->user_id]);

        return response()->json(['data' => $organization->fresh()]);
    }
}
