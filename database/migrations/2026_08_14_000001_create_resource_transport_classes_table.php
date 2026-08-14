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
        if (Schema::hasTable('resource_transport_classes')) {
            return;
        }

        Schema::create('resource_transport_classes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('resource_id')->constrained('resources')->restrictOnDelete();
            $table->string('transport_class');
            $table->timestamps();
        });

        $driver = DB::getDriverName();
        if ($driver === 'pgsql') {
            DB::statement("ALTER TABLE resource_transport_classes ADD CONSTRAINT resource_transport_classes_transport_class_check CHECK (transport_class IN ('conveyor', 'water', 'power', 'gas', 'heat'))");
        }

        DB::statement('CREATE UNIQUE INDEX resource_transport_classes_resource_transport_unique ON resource_transport_classes (resource_id, transport_class)');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('resource_transport_classes');
    }
};
