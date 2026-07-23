<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\MachineController;
use App\Http\Controllers\ResourcesController;

Route::get('/machines', [MachineController::class, 'index']);
Route::get('/machines/{id}', [MachineController::class, 'show']);
Route::get('/resources', [ResourcesController::class, 'index']);
