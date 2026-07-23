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
     * Uses filter: ?id=eq.{id}&select=*
     * @param mixed $id
     * @return array|null
     */
    public function getMachine(mixed $id): ?array
    {
        $url = $this->baseUrl . '/rest/v1/machines?id=eq.' . rawurlencode((string)$id) . '&select=*';
        try {
            $resp = Http::withHeaders($this->headers())
                ->timeout(15)
                ->get($url)
                ->throw();
            $json = $resp->json();
            return is_array($json) && count($json) ? $json[0] : null;
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
