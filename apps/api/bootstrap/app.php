<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(web: __DIR__.'/../routes/web.php', api: __DIR__.'/../routes/api.php', commands: __DIR__.'/../routes/console.php', health: '/up')
    ->withMiddleware(fn (Middleware $middleware) => null)
    ->withExceptions(function (Exceptions $exceptions) {
        $exceptions->render(function (ValidationException $exception, Request $request) {
            if ($request->is('api/*')) {
                return response()->json(['error' => ['code' => 'validation_failed', 'message' => 'The request was invalid.', 'details' => $exception->errors()]], 422);
            }
        });
        $exceptions->render(function (HttpExceptionInterface $exception, Request $request) {
            if ($request->is('api/*')) {
                return response()->json(['error' => ['code' => 'request_failed', 'message' => $exception->getMessage() ?: 'The request could not be completed.']], $exception->getStatusCode());
            }
        });
    })
    ->create();
