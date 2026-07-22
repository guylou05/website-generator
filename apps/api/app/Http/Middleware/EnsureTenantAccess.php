<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureTenantAccess
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        $membership = $user?->current_organization_id ? $user->membershipFor($user->current_organization_id) : null;
        abort_unless($membership, 403, 'Select an organization.');
        if (! $request->isMethodSafe()) {
            abort_unless(in_array($membership->role, ['owner', 'admin', 'member'], true), 403, 'This organization role is read-only.');
        }

return $next($request);
    }
}
