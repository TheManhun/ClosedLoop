<?php

namespace App\Http\Controllers;

use App\Services\SupabaseService;
use Illuminate\Http\JsonResponse;

class ResourcesController extends Controller
{
    protected SupabaseService $supabase;

    public function __construct(SupabaseService $supabase)
    {
        $this->supabase = $supabase;
    }

    public function index(): JsonResponse
    {
        $resources = $this->supabase->getResources();
        return response()->json($resources);
    }
}
