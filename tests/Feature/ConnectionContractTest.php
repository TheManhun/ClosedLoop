<?php

use App\Services\SupabaseService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;

beforeEach(function () {
    config([
        'services.supabase' => [
            'url' => 'https://example.supabase.co',
            'anon_key' => 'anon-key',
            'service_role_key' => 'service-role-key',
        ],
    ]);
});

it('normalizes transport classes from canonical resource rows', function () {
    Http::fake([
        'https://example.supabase.co/rest/v1/resources*' => Http::response([
            [
                'id' => 99,
                'stable_key' => 'residual-waste',
                'name' => 'Residual Waste',
                'category' => 'Waste',
                'resource_transport_classes' => [
                    ['transport_class' => 'conveyor'],
                    ['transport_class' => 'water'],
                    ['transport_class' => 'conveyor'],
                ],
            ],
        ], 200),
    ]);

    $service = new SupabaseService();
    $resources = $service->getResources();

    expect($resources)->toHaveCount(1)
        ->and($resources[0]['transport_classes'])->toBe(['conveyor', 'water'])
        ->and($resources[0])->not->toHaveKey('direction');
});

it('includes scenario connections in the canonical scenario payload without persisting derived direction or transport class', function () {
    Http::fake([
        'https://example.supabase.co/rest/v1/scenarios*' => Http::response([
            [
                'id' => 42,
                'stable_key' => 'demo-scenario',
                'name' => 'Demo Scenario',
                'population' => 1200,
                'data_status' => 'draft',
                'map_image' => null,
                'scenario_resources' => [
                    [
                        'id' => 3,
                        'scenario_id' => 42,
                        'resource_id' => 99,
                        'instance_key' => 'residual-waste-1',
                        'display_name' => 'Residual Waste',
                        'initial_quantity' => 100,
                        'current_quantity' => 95,
                        'unit' => 't',
                        'sort_order' => 1,
                        'fixed' => true,
                        'selectable' => true,
                        'resources' => [
                            'id' => 99,
                            'stable_key' => 'residual-waste',
                            'name' => 'Residual Waste',
                            'category' => 'Waste',
                            'unit' => 't',
                            'resource_transport_classes' => [
                                ['transport_class' => 'conveyor'],
                            ],
                        ],
                    ],
                ],
                'scenario_connections' => [
                    [
                        'id' => 10,
                        'scenario_id' => 42,
                        'source_object_id' => 55,
                        'target_object_id' => 66,
                        'resource_id' => 99,
                        'status' => 'active',
                        'created_at' => '2026-08-14T00:00:00Z',
                        'updated_at' => '2026-08-14T00:00:00Z',
                    ],
                ],
            ],
        ], 200),
    ]);

    $service = new SupabaseService();
    $scenario = $service->getScenario(42);

    expect($scenario['scenario_connections'])->toHaveCount(1)
        ->and($scenario['scenario_connections'][0])->toMatchArray([
            'id' => 10,
            'scenario_id' => 42,
            'source_object_id' => 55,
            'target_object_id' => 66,
            'resource_id' => 99,
            'status' => 'active',
        ])
        ->and($scenario['scenario_resources'][0]['resource']['transport_classes'])->toBe(['conveyor'])
        ->and($scenario['scenario_connections'][0])->not->toHaveKey('direction')
        ->and($scenario['scenario_connections'][0])->not->toHaveKey('transport_class');
});

it('enforces the canonical database contract for transport classes and scenario connections where SQLite permits it', function () {
    Schema::dropIfExists('scenario_connections');
    Schema::dropIfExists('resource_transport_classes');
    Schema::dropIfExists('scenario_objects');
    Schema::dropIfExists('scenarios');
    Schema::dropIfExists('resources');

    Schema::create('resources', function ($table) {
        $table->id();
    });
    Schema::create('scenarios', function ($table) {
        $table->id();
    });
    Schema::create('scenario_objects', function ($table) {
        $table->id();
    });

    DB::statement('CREATE TABLE resource_transport_classes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        resource_id INTEGER NOT NULL REFERENCES resources(id) ON DELETE RESTRICT,
        transport_class TEXT NOT NULL CHECK (transport_class IN (\'conveyor\', \'water\', \'power\', \'gas\', \'heat\')),
        created_at TEXT NULL,
        updated_at TEXT NULL,
        UNIQUE (resource_id, transport_class)
    )');

    DB::statement('CREATE TABLE scenario_connections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        scenario_id INTEGER NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
        source_object_id INTEGER NOT NULL REFERENCES scenario_objects(id) ON DELETE CASCADE,
        target_object_id INTEGER NOT NULL REFERENCES scenario_objects(id) ON DELETE CASCADE,
        resource_id INTEGER NOT NULL REFERENCES resources(id) ON DELETE RESTRICT,
        status TEXT NOT NULL DEFAULT \'active\' CHECK (status = \'active\'),
        created_at TEXT NULL,
        updated_at TEXT NULL,
        CHECK (source_object_id <> target_object_id),
        UNIQUE (scenario_id, source_object_id, target_object_id, resource_id)
    )');

    $resourceId = DB::table('resources')->insertGetId([]);
    $scenarioId = DB::table('scenarios')->insertGetId([]);
    $srcId = DB::table('scenario_objects')->insertGetId([]);
    $dstId = DB::table('scenario_objects')->insertGetId([]);

    expect(DB::table('resource_transport_classes')->insert([
        'resource_id' => $resourceId,
        'transport_class' => 'conveyor',
    ]))->toBeTrue()
        ->and(DB::table('resource_transport_classes')->where('resource_id', $resourceId)->count())->toBe(1);

    try {
        DB::table('resource_transport_classes')->insert([
            'resource_id' => $resourceId,
            'transport_class' => 'conveyor',
        ]);
        throw new RuntimeException('Duplicate resource transport class insert unexpectedly succeeded.');
    } catch (\Throwable $e) {
        expect($e)->toBeInstanceOf(\Throwable::class);
    }

    try {
        DB::table('resource_transport_classes')->insert([
            'resource_id' => $resourceId,
            'transport_class' => 'steam',
        ]);
        throw new RuntimeException('Invalid transport class insert unexpectedly succeeded.');
    } catch (\Throwable $e) {
        expect($e)->toBeInstanceOf(\Throwable::class);
    }

    expect(DB::table('scenario_connections')->insert([
        'scenario_id' => $scenarioId,
        'source_object_id' => $srcId,
        'target_object_id' => $dstId,
        'resource_id' => $resourceId,
        'status' => 'active',
    ]))->toBeTrue();

    try {
        DB::table('scenario_connections')->insert([
            'scenario_id' => $scenarioId,
            'source_object_id' => $srcId,
            'target_object_id' => $srcId,
            'resource_id' => $resourceId,
            'status' => 'active',
        ]);
        throw new RuntimeException('Self-connection insert unexpectedly succeeded.');
    } catch (\Throwable $e) {
        expect($e)->toBeInstanceOf(\Throwable::class);
    }

    try {
        DB::table('scenario_connections')->insert([
            'scenario_id' => $scenarioId,
            'source_object_id' => $srcId,
            'target_object_id' => $dstId,
            'resource_id' => $resourceId,
            'status' => 'inactive',
        ]);
        throw new RuntimeException('Invalid connection status insert unexpectedly succeeded.');
    } catch (\Throwable $e) {
        expect($e)->toBeInstanceOf(\Throwable::class);
    }

    expect(DB::table('scenario_connections')->where('scenario_id', $scenarioId)->count())->toBe(1);

    DB::table('scenario_connections')->insert([
        'scenario_id' => $scenarioId,
        'source_object_id' => $dstId,
        'target_object_id' => $srcId,
        'resource_id' => $resourceId,
        'status' => 'active',
    ]);

    expect(DB::table('scenario_connections')->where('scenario_id', $scenarioId)->count())->toBe(2);

    $reverse = DB::table('scenario_connections')->where('scenario_id', $scenarioId)->orderBy('id')->get()->all();
    expect((int) $reverse[0]->source_object_id)->toBe((int) $srcId)
        ->and((int) $reverse[1]->source_object_id)->toBe((int) $dstId);
});
