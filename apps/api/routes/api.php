<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\DeploymentController;
use App\Http\Controllers\GenerationController;
use App\Http\Controllers\InternalJobController;
use App\Http\Controllers\InvitationController;
use App\Http\Controllers\OrganizationController;
use App\Http\Controllers\ProjectController;
use App\Http\Controllers\WordPressConnectionController;
use Illuminate\Support\Facades\Route;

Route::get('/health', fn () => response()->json(['status' => 'ok']));
Route::prefix('auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:5,1');
    Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:5,1');
    Route::post('/forgot-password', [AuthController::class, 'forgot'])->middleware('throttle:5,1');
    Route::post('/reset-password', [AuthController::class, 'reset'])->middleware('throttle:5,1');
});
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/user', [AuthController::class, 'user']);
    Route::post('/auth/email/verification-notification', [AuthController::class, 'verification'])->middleware('throttle:6,1');
    Route::get('/auth/verify-email/{id}/{hash}', [AuthController::class, 'verify'])->middleware(['signed', 'throttle:6,1'])->name('verification.verify');
    Route::apiResource('organizations', OrganizationController::class);
    Route::post('/organizations/{organization}/switch', [OrganizationController::class, 'switch']);
    Route::get('/organizations/{organization}/members', [OrganizationController::class, 'members']);
    Route::patch('/organizations/{organization}/members/{membership}', [OrganizationController::class, 'updateMember']);
    Route::delete('/organizations/{organization}/members/{membership}', [OrganizationController::class, 'removeMember']);
    Route::post('/organizations/{organization}/transfer-ownership', [OrganizationController::class, 'transfer']);
    Route::get('/organizations/{organization}/invitations', [InvitationController::class, 'index']);
    Route::post('/organizations/{organization}/invitations', [InvitationController::class, 'store']);
    Route::delete('/organizations/{organization}/invitations/{invitation}', [InvitationController::class, 'destroy']);
    Route::post('/invitations/{token}/accept', [InvitationController::class, 'accept']);
    Route::middleware('tenant.access')->group(function () {
        Route::apiResource('projects', ProjectController::class);
        Route::get('/projects/{project}/generations', [GenerationController::class, 'index']);
        Route::post('/projects/{project}/generations', [GenerationController::class, 'store']);
        Route::get('/generations/{generationRun}', [GenerationController::class, 'show']);
        Route::post('/generations/{generationRun}/retry', [GenerationController::class, 'retry']);
        Route::post('/generations/{generationRun}/cancel', [GenerationController::class, 'cancel']);
        Route::get('/projects/{project}/wordpress-connections', [WordPressConnectionController::class, 'index']);
        Route::post('/projects/{project}/wordpress-connections', [WordPressConnectionController::class, 'store']);
        Route::get('/wordpress-connections/{connection}', [WordPressConnectionController::class, 'show']);
        Route::patch('/wordpress-connections/{connection}', [WordPressConnectionController::class, 'update']);
        Route::delete('/wordpress-connections/{connection}', [WordPressConnectionController::class, 'destroy']);
        Route::post('/wordpress-connections/{connection}/verify', [WordPressConnectionController::class, 'verify']);
        Route::post('/projects/{project}/deployments/preview', [DeploymentController::class, 'preview']);
        Route::post('/projects/{project}/deployments', [DeploymentController::class, 'store']);
        Route::get('/projects/{project}/deployments', [DeploymentController::class, 'index']);
        Route::get('/deployments/{deployment}', [DeploymentController::class, 'show']);
        Route::post('/deployments/{deployment}/retry', [DeploymentController::class, 'retry']);
        Route::post('/deployments/{deployment}/cancel', [DeploymentController::class, 'cancel']);
    });
});
Route::middleware('internal.worker')->prefix('internal')->group(function () {
    foreach (['generationContext', 'generationCancellation', 'generationStarted', 'generationEvent', 'generationHeartbeat', 'generationCompleted', 'generationFailed'] as $action) {
        $suffix = ['generationContext' => 'execution-context', 'generationCancellation' => 'cancellation-status', 'generationStarted' => 'started', 'generationEvent' => 'events', 'generationHeartbeat' => 'heartbeat', 'generationCompleted' => 'completed', 'generationFailed' => 'failed'][$action];
        Route::match(str_contains($action, 'Context') || str_contains($action, 'Cancellation') ? ['GET'] : ['POST'], "/generations/{generationRun}/$suffix", [InternalJobController::class, $action]);
    }foreach (['deploymentContext', 'deploymentCancellation', 'deploymentStarted', 'deploymentEvent', 'deploymentHeartbeat', 'deploymentCompleted', 'deploymentFailed'] as $action) {
        $suffix = ['deploymentContext' => 'execution-context', 'deploymentCancellation' => 'cancellation-status', 'deploymentStarted' => 'started', 'deploymentEvent' => 'events', 'deploymentHeartbeat' => 'heartbeat', 'deploymentCompleted' => 'completed', 'deploymentFailed' => 'failed'][$action];
        Route::match(str_contains($action, 'Context') || str_contains($action, 'Cancellation') ? ['GET'] : ['POST'], "/deployments/{deployment}/$suffix", [InternalJobController::class, $action]);
    }
});
