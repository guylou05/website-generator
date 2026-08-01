<?php

namespace App\Http\Controllers;

use App\Models\Deployment;
use App\Models\GenerationRun;
use App\Support\EnvironmentValidator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Facades\Storage;
use Throwable;

class OperationsController extends Controller
{
    public function health(): JsonResponse
    {
        return response()->json(['status' => 'ok', 'version' => config('app.version', '0.1.0')]);
    }

    public function readiness(): JsonResponse
    {
        $result = Cache::remember('operations:readiness', 15, function (): array {
            $check = fn (callable $callback) => $this->check($callback);
            try {
                $worker = GenerationRun::query()->whereNotNull('heartbeat_at')->max('heartbeat_at')
                    ?? Deployment::query()->whereNotNull('heartbeat_at')->max('heartbeat_at');
            } catch (Throwable) {
                $worker = null;
            }
            $checks = [
                'database' => $check(fn () => DB::select('select 1')),
                'redis' => $check(fn () => Redis::connection()->ping()),
                'storage' => $check(fn () => Storage::disk(config('filesystems.default'))->exists('.')),
                'queue' => ['status' => config('queue.default') === 'sync' ? 'degraded' : 'ok', 'driver' => config('queue.default')],
                'mail' => ['status' => config('mail.default') ? 'ok' : 'error', 'driver' => config('mail.default')],
                'worker' => ['status' => $worker ? 'ok' : 'unknown', 'last_heartbeat' => $worker],
                'scheduler' => ['status' => Cache::get('scheduler:heartbeat') ? 'ok' : 'unknown', 'last_heartbeat' => Cache::get('scheduler:heartbeat')],
            ];
            $failed = collect($checks)->contains(fn ($value) => ($value['status'] ?? null) === 'error');

            return ['body' => [
                'status' => $failed ? 'degraded' : 'ok', 'checks' => $checks,
                'version' => config('app.version', '0.1.0'), 'git_commit' => env('GIT_COMMIT_SHA', env('RAILWAY_GIT_COMMIT_SHA')),
                'deployed_at' => env('DEPLOYMENT_TIMESTAMP'),
            ], 'status' => $failed ? 503 : 200];
        });

        return response()->json($result['body'], $result['status']);
    }

    public function environment(Request $request, EnvironmentValidator $validator): JsonResponse
    {
        $membership = $request->user()?->membershipFor((string) $request->user()?->current_organization_id);
        abort_unless(in_array($membership?->role, ['owner', 'admin'], true), 403);

        return response()->json(['data' => [
            'api_url' => config('app.url'), 'proxy_mode' => $request->header('x-forwarded-host') !== null,
            'cookie_mode' => ['domain' => config('session.domain') ?: 'host-only', 'secure' => config('session.secure'), 'same_site' => config('session.same_site')],
            'auth_driver' => env('AUTH_DRIVER', 'sanctum'), 'sanctum' => ['stateful_domains' => config('sanctum.stateful')],
            'csrf' => 'enabled', 'session_driver' => config('session.driver'), 'redis' => config('database.redis.client'),
            'database' => config('database.default'), 'worker' => config('queue.default'), 'scheduler' => 'schedule:work',
            'railway' => ['detected' => (bool) env('RAILWAY_ENVIRONMENT_NAME'), 'environment' => env('RAILWAY_ENVIRONMENT_NAME')],
            'validation_errors' => $validator->errors(),
            'safe_environment' => array_filter(['APP_ENV' => config('app.env'), 'APP_URL' => config('app.url'), 'SESSION_DOMAIN' => config('session.domain'), 'SESSION_SAME_SITE' => config('session.same_site'), 'QUEUE_CONNECTION' => config('queue.default')], fn ($value) => $value !== null),
        ]]);
    }

    private function check(callable $callback): array
    {
        try {
            $callback();

            return ['status' => 'ok'];
        } catch (Throwable $exception) {
            return ['status' => 'error', 'message' => 'Check unavailable'];
        }
    }
}
