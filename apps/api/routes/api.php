<?php

use App\Http\Controllers\DeploymentController;
use App\Http\Controllers\GenerationController;
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
