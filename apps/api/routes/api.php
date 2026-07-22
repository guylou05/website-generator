<?php

use App\Http\Controllers\DeploymentController;
use App\Http\Controllers\GenerationController;
use App\Http\Controllers\InternalJobController;
use App\Http\Controllers\ProjectController;
use App\Http\Controllers\WordPressConnectionController;
use Illuminate\Support\Facades\Route;

Route::get('/health', fn () => response()->json(['status' => 'ok']));
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

Route::middleware('internal.worker')->prefix('internal')->group(function () {
    Route::get('/generations/{generationRun}/execution-context', [InternalJobController::class, 'generationContext']);
    Route::get('/generations/{generationRun}/cancellation-status', [InternalJobController::class, 'generationCancellation']);
    Route::post('/generations/{generationRun}/started', [InternalJobController::class, 'generationStarted']);
    Route::post('/generations/{generationRun}/events', [InternalJobController::class, 'generationEvent']);
    Route::post('/generations/{generationRun}/heartbeat', [InternalJobController::class, 'generationHeartbeat']);
    Route::post('/generations/{generationRun}/completed', [InternalJobController::class, 'generationCompleted']);
    Route::post('/generations/{generationRun}/failed', [InternalJobController::class, 'generationFailed']);
    Route::get('/deployments/{deployment}/execution-context', [InternalJobController::class, 'deploymentContext']);
    Route::get('/deployments/{deployment}/cancellation-status', [InternalJobController::class, 'deploymentCancellation']);
    Route::post('/deployments/{deployment}/started', [InternalJobController::class, 'deploymentStarted']);
    Route::post('/deployments/{deployment}/events', [InternalJobController::class, 'deploymentEvent']);
    Route::post('/deployments/{deployment}/heartbeat', [InternalJobController::class, 'deploymentHeartbeat']);
    Route::post('/deployments/{deployment}/completed', [InternalJobController::class, 'deploymentCompleted']);
    Route::post('/deployments/{deployment}/failed', [InternalJobController::class, 'deploymentFailed']);
});
