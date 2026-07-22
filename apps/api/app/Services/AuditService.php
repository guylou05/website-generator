<?php

namespace App\Services;

use App\Models\AuditLog;
use Illuminate\Http\Request;

class AuditService
{
    private const SENSITIVE = ['password', 'password_confirmation', 'token', 'application_password', 'api_key'];

    public function record(Request $request, string $action, string $type, ?string $id = null, array $metadata = [], ?string $organizationId = null): void
    {
        $metadata = array_diff_key($metadata, array_flip(self::SENSITIVE));
        AuditLog::create(['organization_id' => $organizationId ?? $request->user()?->current_organization_id, 'actor_type' => $request->user() ? 'user' : 'system', 'actor_id' => $request->user()?->id, 'action' => $action, 'auditable_type' => $type, 'auditable_id' => $id, 'metadata' => $metadata ?: null, 'ip_address' => $request->ip(), 'user_agent' => mb_substr((string) $request->userAgent(), 0, 1000)]);
    }
}
