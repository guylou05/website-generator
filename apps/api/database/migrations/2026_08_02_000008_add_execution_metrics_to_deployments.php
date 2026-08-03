<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('deployments', function (Blueprint $table) {
            $table->unsignedBigInteger('duration_ms')->nullable();
            $table->unsignedInteger('steps_completed')->default(0);
            $table->json('warnings')->nullable();
            $table->string('connector_version')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('deployments', fn (Blueprint $table) => $table->dropColumn(['duration_ms', 'steps_completed', 'warnings', 'connector_version']));
    }
};
