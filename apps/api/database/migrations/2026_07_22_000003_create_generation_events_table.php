<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('generation_events', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('generation_run_id')->constrained()->cascadeOnDelete();
            $table->string('stage');
            $table->string('event_type');
            $table->unsignedTinyInteger('progress')->nullable();
            $table->text('message')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->index(['generation_run_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('generation_events');
    }
};
