<?php

namespace App\Http\Controllers;

use App\Services\SupabaseService;
use Illuminate\Http\JsonResponse;

class ScenarioController extends Controller
{
    protected SupabaseService $supabase;

    public function __construct(SupabaseService $supabase)
    {
        $this->supabase = $supabase;
    }

    /**
     * Return a single scenario by id with its scenario_resources.
     *
     * @param  mixed  $id
     */
    public function show($id): JsonResponse
    {
        if (! is_numeric($id)) {
            return response()->json(['message' => 'Not Found'], 404);
        }

        $scenario = $this->supabase->getScenario((int) $id);
        if (is_null($scenario)) {
            return response()->json(['message' => 'Not Found'], 404);
        }

        return response()->json($scenario);
    }
}
