<?php

use App\Http\Controllers\GenerationController;
use App\Http\Controllers\ProjectController;
use Illuminate\Support\Facades\Route;

Route::get('/health', fn () => response()->json(['status' => 'ok']));
Route::apiResource('projects', ProjectController::class);
Route::get('/projects/{project}/generations', [GenerationController::class, 'index']);
Route::post('/projects/{project}/generations', [GenerationController::class, 'store']);
Route::get('/generations/{generationRun}', [GenerationController::class, 'show']);
Route::post('/generations/{generationRun}/retry', [GenerationController::class, 'retry']);
Route::post('/generations/{generationRun}/cancel', [GenerationController::class, 'cancel']);
