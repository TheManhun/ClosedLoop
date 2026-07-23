<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Log;
use Illuminate\Http\Client\RequestException;

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
     *
     * @param bool $useServiceRole
     * @return array
     */
    protected function headers(bool $useServiceRole = false): array
    {
        $key = $useServiceRole ? $this->serviceRoleKey : $this->anonKey;
        $headers = [
            'Content-Type' => 'application/json',
        ];
        if ($key) {
            $headers['apikey'] = $key;
            $headers['Authorization'] = 'Bearer ' . $key;
        }
        return $headers;
    }

    /**
     * GET /rest/v1/resources?select=*
     * @return array
     */
    public function getResources(): array
    {
        $url = $this->baseUrl . '/rest/v1/resources?select=*';
        try {
            $resp = Http::withHeaders($this->headers())
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
     * GET /rest/v1/machines?select=*
     * @return array
     */
    public function getMachines(): array
    {
        $url = $this->baseUrl . '/rest/v1/machines?select=*';
        try {
            $resp = Http::withHeaders($this->headers())
                ->timeout(15)
                ->get($url)
                ->throw();
            return $resp->json();
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
     * @param mixed $id
     * @return array|null
     */
    public function getMachine(mixed $id): ?array
    {
        // Use the actual relation name 'resources' (plural) inside machine_resources
        // Include machine_technologies -> technologies relationship
        $select = rawurlencode('id,name,description,category,image,configurable,power_required,water_required,footprint_x,footprint_y,machine_resources(direction,amount,unit,resources(id,name,category,image)),machine_links(title,url,link_type,organisation,description,publication_date,verified),machine_technologies(role,description,technologies(id,name,description,category,maturity_level,image,notes))');
        $url = $this->baseUrl . '/rest/v1/machines?id=eq.' . rawurlencode((string)$id) . '&select=' . $select;
        try {
            $resp = Http::withHeaders($this->headers())
                ->timeout(15)
                ->get($url)
                ->throw();
            $json = $resp->json();
            if (!is_array($json) || count($json) === 0) return null;
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

            // machine_resources relationship (if present)
            // Normalize into flattened `resources` array with the shape requested by the API consumer.
            if (!empty($m['machine_resources']) && is_array($m['machine_resources'])) {
                foreach ($m['machine_resources'] as $mr) {
                    // Supabase returns the joined resource under the relation name used in the select.
                    // We requested `resources(...)` so prefer that, but be tolerant of either form.
                    $resObj = $mr['resources'] ?? $mr['resource'] ?? null;
                    // If the relation came back as an indexed array, take the first element
                    if (is_array($resObj) && array_values($resObj) === $resObj) {
                        $resObj = $resObj[0] ?? null;
                    }

                    $out['resources'][] = [
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

            // machine_links relationship (if present)
            if (!empty($m['machine_links']) && is_array($m['machine_links'])) {
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
            if (!empty($m['machine_technologies']) && is_array($m['machine_technologies'])) {
                foreach ($m['machine_technologies'] as $mt) {
                    // joined technologies relation may be under 'technologies' or 'technology'
                    $techObj = $mt['technologies'] ?? $mt['technology'] ?? null;
                    // if array, take first
                    if (is_array($techObj) && array_values($techObj) === $techObj) {
                        $techObj = $techObj[0] ?? null;
                    }
                    if (!$techObj) continue;
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
     * Diagnostic fetch for raw status and body without throwing.
     * Returns ['status' => int|null, 'body' => string]
     */
    public function diagnoseEndpoint(string $path): array
    {
        $url = $this->baseUrl . $path;
        $resp = Http::withHeaders($this->headers())
            ->timeout(15)
            ->get($url);
        return ['status' => $resp->status(), 'body' => $resp->body()];
    }
}
