<?php

use App\Http\Controllers\MachineController;
use App\Http\Controllers\ResourcesController;
use Illuminate\Support\Facades\Route;

Route::get('/machines', [MachineController::class, 'index']);
Route::get('/machines/{id}', [MachineController::class, 'show']);
Route::get('/resources', [ResourcesController::class, 'index']);
// Scenario endpoint (Stage 2 read-only)
// (defined in routes/web.php to match the app's route-file convention)
// (diagnostics removed)
