<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (! Schema::hasTable('scenario_objects')) {
            return;
        }

        Schema::table('scenario_objects', function (Blueprint $table) {
            $table->integer('grid_x')->nullable()->after('position_x');
            $table->integer('grid_y')->nullable()->after('grid_x');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (! Schema::hasTable('scenario_objects')) {
            return;
        }

        Schema::table('scenario_objects', function (Blueprint $table) {
            $table->dropColumn(['grid_x', 'grid_y']);
        });
    }
};
