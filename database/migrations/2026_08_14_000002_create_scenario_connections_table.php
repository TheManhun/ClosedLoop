<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::hasTable('scenario_connections')) {
            return;
        }

        Schema::create('scenario_connections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('scenario_id')->constrained('scenarios')->cascadeOnDelete();
            $table->foreignId('source_object_id')->constrained('scenario_objects')->cascadeOnDelete();
            $table->foreignId('target_object_id')->constrained('scenario_objects')->cascadeOnDelete();
            $table->foreignId('resource_id')->constrained('resources')->restrictOnDelete();
            $table->string('status')->default('active');
            $table->timestamps();
        });

        $driver = DB::getDriverName();
        if ($driver === 'pgsql') {
            DB::statement("ALTER TABLE scenario_connections ADD CONSTRAINT scenario_connections_status_check CHECK (status = 'active')");
            DB::statement('ALTER TABLE scenario_connections ADD CONSTRAINT scenario_connections_no_self_connection CHECK (source_object_id <> target_object_id)');
        }

        DB::statement('CREATE UNIQUE INDEX scenario_connections_directed_unique ON scenario_connections (scenario_id, source_object_id, target_object_id, resource_id)');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('scenario_connections');
    }
};
