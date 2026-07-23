<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\SupabaseService;

class TestSupabase extends Command
{
    protected $signature = 'supabase:test';
    protected $description = 'Test Supabase connectivity by fetching machines and resources';

    protected SupabaseService $supabase;

    public function __construct(SupabaseService $supabase)
    {
        parent::__construct();
        $this->supabase = $supabase;
    }

    public function handle()
    {
        $this->info('Diagnostic: configured Supabase URL: ' . config('services.supabase.url'));
        $this->info('Diagnostic: anon key present: ' . (config('services.supabase.anon_key') ? 'yes' : 'no'));
        $this->info('---');

        // Run diagnostic endpoints
        try {
            $diag = $this->supabase->diagnoseEndpoint('/rest/v1/machines?select=*');
            $this->info('Machines endpoint status: ' . $diag['status']);
            $this->line('Machines endpoint body:');
            $this->line($diag['body']);
        } catch (\Exception $e) {
            $this->error('Machines diagnostic failed: ' . $e->getMessage());
        }

        try {
            $diag = $this->supabase->diagnoseEndpoint('/rest/v1/resources?select=*');
            $this->info('Resources endpoint status: ' . $diag['status']);
            $this->line('Resources endpoint body:');
            $this->line($diag['body']);
        } catch (\Exception $e) {
            $this->error('Resources diagnostic failed: ' . $e->getMessage());
        }

        $this->info('---');

        $this->info('Fetching machines...');
        try {
            $machines = $this->supabase->getMachines();
            $this->info('Machines: ' . count($machines));
            $this->line(json_encode(array_slice($machines, 0, 5), JSON_PRETTY_PRINT));
        } catch (\Exception $e) {
            $this->error('Failed to fetch machines: ' . $e->getMessage());
        }

        $this->info('Fetching resources...');
        try {
            $resources = $this->supabase->getResources();
            $this->info('Resources: ' . count($resources));
            $this->line(json_encode(array_slice($resources, 0, 5), JSON_PRETTY_PRINT));
        } catch (\Exception $e) {
            $this->error('Failed to fetch resources: ' . $e->getMessage());
        }

        return 0;
    }
}
