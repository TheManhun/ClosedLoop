<?php

namespace App\Services;

use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SupabaseService
{
    protected string $baseUrl;

    protected ?string $anonKey;

    protected ?string $serviceRoleKey;

    public function __construct()
    {
        $cfg = config('services.supabase', []);
        $this->baseUrl = rtrim(Arr::get($cfg, 'url', ''), '/');
        $this->anonKey = Arr::get($cfg, 'anon_key');
        $this->serviceRoleKey = Arr::get($cfg, 'service_role_key');
    }

    /**
     * Return headers for Supabase requests.
     * Use service role key when $useServiceRole is true, otherwise use anon key.
     */
    protected function headers(bool $useServiceRole = false): array
    {
        $key = $useServiceRole ? $this->serviceRoleKey : $this->anonKey;
        $headers = [
            'Content-Type' => 'application/json',
        ];
        if ($key) {
            $headers['apikey'] = $key;
            $headers['Authorization'] = 'Bearer '.$key;
        }

        return $headers;
    }

    /**
     * GET /rest/v1/resources?select=*
     */
    public function getResources(): array
    {
        $url = $this->baseUrl.'/rest/v1/resources?select=*';
        try {
            $resp = Http::withHeaders($this->headers(true))
                ->timeout(15)
                ->get($url)
                ->throw();

            return $resp->json();
        } catch (RequestException $e) {
            $r = $e->response;
            $status = $r ? $r->status() : null;
            $body = $r ? $r->body() : $e->getMessage();
            Log::error('Supabase getResources failed', ['url' => $url, 'status' => $status, 'body' => $body]);
            throw $e;
        }
    }

    /**
     * Normalize machine_resources rows into the same flattened `resources` array shape
     * used by the single-machine API.
     */
    protected function normalizeMachineResources(array $machine): array
    {
        $resources = [];

        if (! empty($machine['machine_resources']) && is_array($machine['machine_resources'])) {
            foreach ($machine['machine_resources'] as $mr) {
                $resObj = $mr['resources'] ?? $mr['resource'] ?? null;
                if (is_array($resObj) && array_values($resObj) === $resObj) {
                    $resObj = $resObj[0] ?? null;
                }

                $resources[] = [
                    'id' => $resObj['id'] ?? null,
                    'name' => $resObj['name'] ?? null,
                    'description' => $resObj['description'] ?? null,
                    'category' => $resObj['category'] ?? null,
                    'direction' => $mr['direction'] ?? null,
                    'amount' => $mr['amount'] ?? null,
                    'unit' => $mr['unit'] ?? null,
                ];
            }
        }

        $machine['resources'] = $resources;

        return $machine;
    }

    /**
     * GET /rest/v1/machines?select=...
     */
    public function getMachines(): array
    {
        $select = rawurlencode('id,name,description,category,image,configurable,power_required,water_required,footprint_x,footprint_y,machine_resources(direction,amount,unit,resources(id,name,description,category,image))');
        $url = $this->baseUrl.'/rest/v1/machines?select='.$select;
        try {
            $resp = Http::withHeaders($this->headers(true))
                ->timeout(15)
                ->get($url)
                ->throw();

            $json = $resp->json();
            if (! is_array($json)) {
                return [];
            }

            foreach ($json as $index => $machine) {
                if (is_array($machine)) {
                    $json[$index] = $this->normalizeMachineResources($machine);
                }
            }

            return $json;
        } catch (RequestException $e) {
            $r = $e->response;
            $status = $r ? $r->status() : null;
            $body = $r ? $r->body() : $e->getMessage();
            Log::error('Supabase getMachines failed', ['url' => $url, 'status' => $status, 'body' => $body]);
            throw $e;
        }
    }

    /**
     * GET machine by primary key id
     * Uses filter with nested relations to include machine_resources and machine_links
     * Example select: id,name,description,category,image,configurable,power_required,water_required,footprint_x,footprint_y,machine_resources(direction,amount,unit,resource:id,name,category,image),machine_links(title,url,link_type,organisation,description,publication_date,verified)
     */
    public function getMachine(mixed $id): ?array
    {
        // Use the actual relation name 'resources' (plural) inside machine_resources
        // Include machine_technologies -> technologies relationship
        $select = rawurlencode('id,name,description,category,image,configurable,power_required,water_required,footprint_x,footprint_y,machine_resources(direction,amount,unit,resources(id,name,category,image)),machine_links(title,url,link_type,organisation,description,publication_date,verified),machine_technologies(role,description,technologies(id,name,description,category,maturity_level,image,notes))');
        $url = $this->baseUrl.'/rest/v1/machines?id=eq.'.rawurlencode((string) $id).'&select='.$select;
        try {
            $resp = Http::withHeaders($this->headers(true))
                ->timeout(15)
                ->get($url)
                ->throw();
            $json = $resp->json();
            if (! is_array($json) || count($json) === 0) {
                return null;
            }
            $m = $json[0];

            // Normalize response into the expected shape
            $out = [
                'id' => $m['id'] ?? null,
                'name' => $m['name'] ?? null,
                'description' => $m['description'] ?? null,
                'category' => $m['category'] ?? null,
                'image' => $m['image'] ?? null,
                'configurable' => isset($m['configurable']) ? boolval($m['configurable']) : false,
                'power_required' => $m['power_required'] ?? null,
                'water_required' => $m['water_required'] ?? null,
                'footprint_x' => $m['footprint_x'] ?? null,
                'footprint_y' => $m['footprint_y'] ?? null,
                'resources' => [],
                'links' => [],
                'technologies' => [],
            ];

            $m = $this->normalizeMachineResources($m);
            $out['resources'] = $m['resources'] ?? [];

            // machine_links relationship (if present)
            if (! empty($m['machine_links']) && is_array($m['machine_links'])) {
                foreach ($m['machine_links'] as $ln) {
                    $out['links'][] = [
                        'title' => $ln['title'] ?? null,
                        'url' => $ln['url'] ?? null,
                        'link_type' => $ln['link_type'] ?? null,
                        'organisation' => $ln['organisation'] ?? null,
                        'description' => $ln['description'] ?? null,
                        'publication_date' => $ln['publication_date'] ?? null,
                        'verified' => isset($ln['verified']) ? boolval($ln['verified']) : false,
                    ];
                }
            }

            // machine_technologies -> technologies relationship
            if (! empty($m['machine_technologies']) && is_array($m['machine_technologies'])) {
                foreach ($m['machine_technologies'] as $mt) {
                    // joined technologies relation may be under 'technologies' or 'technology'
                    $techObj = $mt['technologies'] ?? $mt['technology'] ?? null;
                    // if array, take first
                    if (is_array($techObj) && array_values($techObj) === $techObj) {
                        $techObj = $techObj[0] ?? null;
                    }
                    if (! $techObj) {
                        continue;
                    }
                    $out['technologies'][] = [
                        'id' => $techObj['id'] ?? null,
                        'name' => $techObj['name'] ?? null,
                        'description' => $techObj['description'] ?? null,
                        'category' => $techObj['category'] ?? null,
                        'maturity_level' => $techObj['maturity_level'] ?? null,
                        'image' => $techObj['image'] ?? null,
                        'notes' => $techObj['notes'] ?? null,
                        'role' => $mt['role'] ?? null,
                        'relationship_description' => $mt['description'] ?? null,
                    ];
                }
            }

            return $out;
        } catch (RequestException $e) {
            $r = $e->response;
            $status = $r ? $r->status() : null;
            $body = $r ? $r->body() : $e->getMessage();
            Log::error('Supabase getMachine failed', ['url' => $url, 'status' => $status, 'body' => $body]);
            throw $e;
        }
    }

    /**
     * GET scenario by primary key id
     * Includes nested scenario_resources and joined resources metadata.
     */
    public function getScenario(mixed $id): ?array
    {
        // Request fields: id,stable_key,name,population,reference_year,data_status,
        // and nested scenario_resources with joined resources fields.
        $select = rawurlencode('id,stable_key,name,population,reference_year,data_status,map_image,scenario_resources(id,scenario_id,resource_id,instance_key,display_name,initial_quantity,current_quantity,unit,sort_order,environmental_impact_score,impact_metadata,fixed,selectable,notes,resources(id,stable_key,name,category,unit,image,physical_state,is_pollutant,visual_type)),scenario_objects(id,scenario_id,object_key,object_type,name,machine_id,grid_x,grid_y,position_x,position_y,rotation,fixed,selectable,object_config,notes,machines(id,stable_key,name,category,image,footprint_x,footprint_y))');
        $url = $this->baseUrl.'/rest/v1/scenarios?id=eq.'.rawurlencode((string) $id).'&select='.$select;
        try {
            $resp = Http::withHeaders($this->headers(true))
                ->timeout(15)
                ->get($url)
                ->throw();
            $json = $resp->json();
            if (! is_array($json) || count($json) === 0) {
                return null;
            }
            $s = $json[0];

            $out = [
                'id' => $s['id'] ?? null,
                'stable_key' => $s['stable_key'] ?? null,
                'name' => $s['name'] ?? null,
                'population' => $s['population'] ?? null,
                'reference_year' => $s['reference_year'] ?? null,
                'data_status' => $s['data_status'] ?? null,
                'map_image' => $s['map_image'] ?? null,
                'scenario_resources' => [],
                'scenario_objects' => [],
            ];

            if (! empty($s['scenario_resources']) && is_array($s['scenario_resources'])) {
                foreach ($s['scenario_resources'] as $sr) {
                    $resObj = $sr['resources'] ?? $sr['resource'] ?? null;
                    // If relation returned as array, take first
                    if (is_array($resObj) && array_values($resObj) === $resObj) {
                        $resObj = $resObj[0] ?? null;
                    }

                    $out['scenario_resources'][] = [
                        'id' => $sr['id'] ?? null,
                        'scenario_id' => $sr['scenario_id'] ?? null,
                        'resource_id' => $sr['resource_id'] ?? null,
                        'instance_key' => $sr['instance_key'] ?? null,
                        'display_name' => $sr['display_name'] ?? null,
                        'initial_quantity' => $sr['initial_quantity'] ?? null,
                        'current_quantity' => $sr['current_quantity'] ?? null,
                        'unit' => $sr['unit'] ?? null,
                        'sort_order' => $sr['sort_order'] ?? null,
                        'environmental_impact_score' => $sr['environmental_impact_score'] ?? null,
                        'impact_metadata' => $sr['impact_metadata'] ?? null,
                        'fixed' => isset($sr['fixed']) ? boolval($sr['fixed']) : null,
                        'selectable' => isset($sr['selectable']) ? boolval($sr['selectable']) : null,
                        'notes' => $sr['notes'] ?? null,
                        'resource' => $resObj ? [
                            'id' => $resObj['id'] ?? null,
                            'stable_key' => $resObj['stable_key'] ?? null,
                            'name' => $resObj['name'] ?? null,
                            'category' => $resObj['category'] ?? null,
                            'unit' => $resObj['unit'] ?? null,
                            'image' => $resObj['image'] ?? null,
                            'physical_state' => $resObj['physical_state'] ?? null,
                            'visual_type' => $resObj['visual_type'] ?? null,
                            'is_pollutant' => isset($resObj['is_pollutant']) ? boolval($resObj['is_pollutant']) : null,
                        ] : null,
                    ];
                }
            }

            // Ensure scenario_resources are ordered by numeric sort_order ascending
            if (! empty($out['scenario_resources']) && is_array($out['scenario_resources'])) {
                usort($out['scenario_resources'], function ($a, $b) {
                    $sa = isset($a['sort_order']) ? (int) $a['sort_order'] : PHP_INT_MAX;
                    $sb = isset($b['sort_order']) ? (int) $b['sort_order'] : PHP_INT_MAX;

                    return $sa <=> $sb;
                });
            }

            // Normalize scenario_objects if provided (include nested machines relation)
            if (! empty($s['scenario_objects']) && is_array($s['scenario_objects'])) {
                foreach ($s['scenario_objects'] as $so) {
                    $machinesObj = $so['machines'] ?? $so['machine'] ?? null;
                    if (is_array($machinesObj) && array_values($machinesObj) === $machinesObj) {
                        $machinesObj = $machinesObj[0] ?? null;
                    }

                    // Normalize object_config: convert empty arrays to empty object so JSON encodes as {}
                    $objConf = $so['object_config'] ?? null;
                    if (is_array($objConf) && empty($objConf)) {
                        $objConf = (object) [];
                    }

                    $out['scenario_objects'][] = [
                        'id' => $so['id'] ?? null,
                        'scenario_id' => $so['scenario_id'] ?? null,
                        'object_key' => $so['object_key'] ?? null,
                        'object_type' => $so['object_type'] ?? null,
                        'name' => $so['name'] ?? null,
                        'machine_id' => $so['machine_id'] ?? null,
                        'grid_x' => $so['grid_x'] ?? null,
                        'grid_y' => $so['grid_y'] ?? null,
                        'position_x' => $so['position_x'] ?? null,
                        'position_y' => $so['position_y'] ?? null,
                        'rotation' => $so['rotation'] ?? null,
                        'fixed' => isset($so['fixed']) ? boolval($so['fixed']) : null,
                        'selectable' => isset($so['selectable']) ? boolval($so['selectable']) : null,
                        'object_config' => $objConf,
                        'notes' => $so['notes'] ?? null,
                        'machine' => $machinesObj ? [
                            'id' => $machinesObj['id'] ?? null,
                            'stable_key' => $machinesObj['stable_key'] ?? null,
                            'name' => $machinesObj['name'] ?? null,
                            'category' => $machinesObj['category'] ?? null,
                            'image' => $machinesObj['image'] ?? null,
                            'footprint_x' => $machinesObj['footprint_x'] ?? null,
                            'footprint_y' => $machinesObj['footprint_y'] ?? null,
                        ] : null,
                    ];
                }
            }

            return $out;
        } catch (RequestException $e) {
            $r = $e->response;
            $status = $r ? $r->status() : null;
            $body = $r ? $r->body() : $e->getMessage();
            Log::error('Supabase getScenario failed', ['url' => $url, 'status' => $status, 'body' => $body]);
            throw $e;
        }
    }

    /**
     * Diagnostic fetch for raw status and body without throwing.
     * Returns ['status' => int|null, 'body' => string]
     */
    public function diagnoseEndpoint(string $path): array
    {
        $url = $this->baseUrl.$path;
        $resp = Http::withHeaders($this->headers())
            ->timeout(15)
            ->get($url);

        return ['status' => $resp->status(), 'body' => $resp->body()];
    }
}
