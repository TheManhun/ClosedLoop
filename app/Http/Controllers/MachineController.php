<?php

namespace App\Http\Controllers;

use App\Services\SupabaseService;
use Illuminate\Http\JsonResponse;

class MachineController extends Controller
{
    protected SupabaseService $supabase;

    public function __construct(SupabaseService $supabase)
    {
        $this->supabase = $supabase;
    }

    /**
     * Return all machines from Supabase
     *
     * @return JsonResponse
     */
    public function index(): JsonResponse
    {
        $machines = $this->supabase->getMachines();
        return response()->json($machines);
    }

    /**
     * Return a single machine by id
     *
     * @param mixed $id
     * @return JsonResponse
     */
    public function show($id): JsonResponse
    {
        $machine = $this->supabase->getMachine($id);
        if (is_null($machine)) {
            return response()->json(['message' => 'Not Found'], 404);
        }
        return response()->json($machine);
    }
}
