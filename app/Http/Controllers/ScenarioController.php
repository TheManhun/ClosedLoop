<?php

namespace App\Http\Controllers;

use App\Services\PlacementCommitService;
use App\Services\SupabaseService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ScenarioController extends Controller
{
    protected SupabaseService $supabase;

    protected PlacementCommitService $placementCommitService;

    public function __construct(SupabaseService $supabase, PlacementCommitService $placementCommitService)
    {
        $this->supabase = $supabase;
        $this->placementCommitService = $placementCommitService;
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

    public function store($scenarioId, Request $request): JsonResponse
    {
        if (! is_numeric($scenarioId)) {
            return response()->json(['message' => 'Not Found'], 404);
        }

        $payload = $request->json()->all();
        if (! is_array($payload)) {
            $payload = [];
        }

        $required = ['machine_id', 'grid_x', 'grid_y'];
        foreach ($required as $field) {
            if (! array_key_exists($field, $payload) || $payload[$field] === null || $payload[$field] === '') {
                return response()->json(['message' => 'Missing required placement field: '.$field], 422);
            }
        }

        $payload['scenario_id'] = (int) $scenarioId;
        $payload['object_type'] = $payload['object_type'] ?? 'machine';
        $payload['rotation'] = $payload['rotation'] ?? 0;
        $payload['fixed'] = $payload['fixed'] ?? true;
        $payload['selectable'] = $payload['selectable'] ?? true;
        $payload['object_config'] = $payload['object_config'] ?? [];

        try {
            $created = $this->placementCommitService->confirm($payload);

            return response()->json($created, 201);
        } catch (\Throwable $e) {
            return response()->json([
                'message' => 'Unable to create scenario object',
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}
