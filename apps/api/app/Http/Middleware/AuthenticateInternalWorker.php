<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class AuthenticateInternalWorker
{
    public function handle(Request $request, Closure $next)
    {
        $expected = (string) config('app.internal_worker_token');
        $provided = (string) $request->bearerToken();
        if ($expected === '' || strlen($expected) !== strlen($provided) || ! hash_equals($expected, $provided)) {
            return response()->json(['error' => ['code' => 'unauthorized', 'message' => 'Worker authentication failed.']], 401);
        }
        if ((int) $request->header('Content-Length', 0) > 262144) {
            return response()->json(['error' => ['code' => 'payload_too_large', 'message' => 'Payload exceeds 256 KiB.']], 413);
        }

        return $next($request);
    }
}
