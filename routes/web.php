<?php

use App\Http\Controllers\PagesController;
use Illuminate\Support\Facades\Route;

Route::get('/', [PagesController::class, 'home'])->name('home');
Route::get('/simulator', [PagesController::class, 'simulator'])->name('simulator');
Route::get('/about', [PagesController::class, 'about'])->name('about');

// Closed Loop V2 Stage 0 verification route
Route::get('/simulator-v2', function () {
	return view('simulator-v2');
})->name('simulator-v2');

// API endpoints (mounted under /api/* because this app configures only web/console routes)
use App\Http\Controllers\MachineController;
use App\Http\Controllers\ResourcesController;

Route::prefix('api')->group(function () {
	Route::get('/machines', [MachineController::class, 'index']);
	Route::get('/machines/{id}', [MachineController::class, 'show']);
	Route::get('/resources', [ResourcesController::class, 'index']);
});
