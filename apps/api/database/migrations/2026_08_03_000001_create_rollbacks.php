<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rollback_plans', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('project_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('source_deployment_id')->constrained('deployments')->restrictOnDelete();
            $table->foreignUuid('rollback_snapshot_id')->constrained('deployment_rollback_snapshots')->restrictOnDelete();
            $table->foreignUuid('wordpress_connection_id')->constrained()->restrictOnDelete();
            $table->string('status')->default('pending_review');
            $table->json('resources');
            $table->json('expected_remote_state')->nullable();
            $table->string('snapshot_checksum', 64);
            $table->string('checksum', 64);
            $table->json('warnings')->nullable();
            $table->json('conflicts')->nullable();
            $table->json('options')->nullable();
            $table->foreignUuid('created_by')->constrained('users')->restrictOnDelete();
            $table->foreignUuid('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();
            $table->unique('source_deployment_id');
        });
        Schema::create('rollbacks', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('project_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('source_deployment_id')->constrained('deployments')->restrictOnDelete();
            $table->foreignUuid('rollback_plan_id')->unique()->constrained()->restrictOnDelete();
            $table->foreignUuid('rollback_snapshot_id')->constrained('deployment_rollback_snapshots')->restrictOnDelete();
            $table->foreignUuid('wordpress_connection_id')->constrained()->restrictOnDelete();
            $table->string('status')->default('approved');
            $table->string('current_stage')->nullable();
            $table->unsignedTinyInteger('progress')->default(0);
            $table->foreignUuid('initiated_by')->constrained('users')->restrictOnDelete();
            $table->foreignUuid('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('reason');
            $table->string('idempotency_key')->unique();
            $table->unsignedInteger('attempt')->default(1);
            $table->timestamp('cancellation_requested_at')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('failed_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->json('result_summary')->nullable();
            $table->json('error_details')->nullable();
            $table->timestamps();
            $table->index(['wordpress_connection_id', 'status']);
        });
        Schema::create('rollback_events', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('rollback_id')->constrained()->cascadeOnDelete();
            $table->string('stage');
            $table->string('event_type');
            $table->unsignedTinyInteger('progress')->nullable();
            $table->text('message')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });
        Schema::create('rollback_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('rollback_id')->constrained()->cascadeOnDelete();
            $table->string('stage');
            $table->string('resource_type');
            $table->string('resource_key');
            $table->string('operation');
            $table->string('status')->default('pending');
            $table->unsignedInteger('attempt')->default(0);
            $table->unsignedBigInteger('remote_id')->nullable();
            $table->json('result')->nullable();
            $table->json('error')->nullable();
            $table->timestamps();
            $table->unique(['rollback_id', 'resource_type', 'resource_key', 'operation'], 'rollback_item_idempotency');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rollback_items');
        Schema::dropIfExists('rollback_events');
        Schema::dropIfExists('rollbacks');
        Schema::dropIfExists('rollback_plans');
    }
};
