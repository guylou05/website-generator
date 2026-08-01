<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RequireVerifiedEmail
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->user()?->hasVerifiedEmail()) {
            return response()->json(['error' => [
                'code' => 'email_verification_required',
                'message' => 'Verify your email address before using this feature.',
                'details' => ['resend_url' => '/api/auth/email/verification-notification'],
            ]], 403);
        }

        return $next($request);
    }
}
