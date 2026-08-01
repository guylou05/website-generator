<?php

namespace App\Http\Controllers;

use App\Models\MediaAsset;
use App\Models\Organization;
use App\Services\AuditService;
use App\Services\EntitlementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OrganizationSettingsController extends Controller
{
    public function show(Request $request, EntitlementService $entitlements): JsonResponse
    {
        return response()->json(['data' => $this->resource($request, $entitlements)]);
    }

    public function update(Request $request, EntitlementService $entitlements, AuditService $audit): JsonResponse
    {
        $organization = $this->organization($request);
        $role = $request->user()->membershipFor($organization->id)?->role;
        abort_unless(in_array($role, ['owner', 'admin'], true), 403, 'Only organization owners and admins may edit organization settings.');
        $data = $request->validate(['name' => 'sometimes|required|string|max:255', 'billing_email' => 'nullable|email|max:255', 'company_website' => 'nullable|url|max:2048', 'industry' => 'nullable|string|max:100', 'timezone' => 'nullable|timezone', 'address' => 'nullable|array', 'address.line1' => 'nullable|string|max:255', 'address.line2' => 'nullable|string|max:255', 'address.city' => 'nullable|string|max:100', 'address.region' => 'nullable|string|max:100', 'address.postal_code' => 'nullable|string|max:32', 'address.country' => 'nullable|string|size:2', 'logo_media_asset_id' => 'nullable|uuid']);
        if (! empty($data['logo_media_asset_id'])) {
            MediaAsset::where('organization_id', $organization->id)->where('mime_type', 'like', 'image/%')->findOrFail($data['logo_media_asset_id']);
        }
        $organization->update($data);
        $audit->record($request, 'organization.settings_updated', 'organization', $organization->id);

        return response()->json(['data' => $this->resource($request, $entitlements)]);
    }

    private function organization(Request $request): Organization
    {
        $organization = Organization::findOrFail($request->user()->current_organization_id);
        abort_unless($request->user()->membershipFor($organization->id), 403);

        return $organization;
    }

    private function resource(Request $request, EntitlementService $entitlements): array
    {
        $organization = $this->organization($request);
        $role = $request->user()->membershipFor($organization->id)->role;

        return ['id' => $organization->id, 'name' => $organization->name, 'slug' => $organization->slug, 'billing_email' => $organization->billing_email, 'company_website' => $organization->company_website, 'industry' => $organization->industry, 'timezone' => $organization->timezone, 'address' => $organization->address, 'logo_media_asset_id' => $organization->logo_media_asset_id, 'role' => $role, 'plan' => $entitlements->currentPlan($organization), 'can_edit' => in_array($role, ['owner', 'admin'], true), 'can_manage_members' => in_array($role, ['owner', 'admin'], true), 'can_manage_billing' => in_array($role, ['owner', 'admin'], true)];
    }
}
