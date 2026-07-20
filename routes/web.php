<?php

use App\Http\Controllers\PagesController;
use Illuminate\Support\Facades\Route;

Route::get('/', [PagesController::class, 'home'])->name('home');
Route::get('/simulator', [PagesController::class, 'simulator'])->name('simulator');
Route::get('/about', [PagesController::class, 'about'])->name('about');
