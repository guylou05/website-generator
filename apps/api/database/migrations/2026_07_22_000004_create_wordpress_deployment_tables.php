<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('wordpress_connections', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('project_id')->constrained()->cascadeOnDelete();
            $table->string('site_url');
            $table->string('username');
            $table->text('encrypted_application_password');
            $table->string('status')->default('unverified');
            $table->string('wordpress_version')->nullable();
            $table->string('elementor_version')->nullable();
            $table->string('connector_version')->nullable();
            $table->timestamp('last_verified_at')->nullable();
            $table->json('last_error')->nullable();
            $table->timestamps();
        });
        Schema::create('deployments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('project_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('generation_run_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('wordpress_connection_id')->constrained()->cascadeOnDelete();
            $table->string('status')->default('pending');
            $table->boolean('dry_run')->default(false);
            $table->unsignedTinyInteger('progress')->default(0);
            $table->string('current_stage')->nullable();
            $table->json('operations')->nullable();
            $table->json('result')->nullable();
            $table->json('error')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });
        Schema::create('deployment_events', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('deployment_id')->constrained()->cascadeOnDelete();
            $table->string('stage');
            $table->string('event_type');
            $table->unsignedTinyInteger('progress')->nullable();
            $table->text('message')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('deployment_events');
        Schema::dropIfExists('deployments');
        Schema::dropIfExists('wordpress_connections');
    }
};
