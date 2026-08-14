<?php

namespace App\Services;

class PlacementCommitService
{
    protected SupabaseService $supabase;

    public function __construct(SupabaseService $supabase)
    {
        $this->supabase = $supabase;
    }

    public function confirm(array $payload): array
    {
        if (! isset($payload['scenario_id']) || ! is_numeric($payload['scenario_id'])) {
            throw new \InvalidArgumentException('scenario_id is required');
        }

        $required = ['machine_id', 'grid_x', 'grid_y'];
        foreach ($required as $field) {
            if (! array_key_exists($field, $payload) || $payload[$field] === null || $payload[$field] === '') {
                throw new \InvalidArgumentException('Missing required placement field: '.$field);
            }
        }

        $normalized = [
            'scenario_id' => (int) $payload['scenario_id'],
            'object_type' => $payload['object_type'] ?? 'machine',
            'object_key' => $payload['object_key'] ?? null,
            'name' => $payload['name'] ?? null,
            'machine_id' => (int) $payload['machine_id'],
            'grid_x' => (int) $payload['grid_x'],
            'grid_y' => (int) $payload['grid_y'],
            'position_x' => $payload['position_x'] ?? null,
            'position_y' => $payload['position_y'] ?? null,
            'rotation' => (int) ($payload['rotation'] ?? 0),
            'fixed' => (bool) ($payload['fixed'] ?? true),
            'selectable' => (bool) ($payload['selectable'] ?? true),
            'object_config' => $payload['object_config'] ?? [],
            'notes' => $payload['notes'] ?? null,
        ];

        return $this->supabase->createScenarioObject((int) $normalized['scenario_id'], $normalized);
    }
}
