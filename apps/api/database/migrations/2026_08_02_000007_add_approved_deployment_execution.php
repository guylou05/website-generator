<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('deployments', function (Blueprint $table) {
            $table->foreignUuid('deployment_plan_id')->nullable()->after('project_id')->constrained()->restrictOnDelete();
            $table->string('approval_checksum', 64)->nullable();
            $table->string('idempotency_key')->nullable()->unique();
            $table->json('result_summary')->nullable();
            $table->json('error_details')->nullable();
            $table->foreignUuid('rollback_snapshot_id')->nullable();
            $table->timestamp('failed_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->index(['deployment_plan_id', 'status']);
        });
        Schema::table('projects', fn (Blueprint $table) => $table->foreignUuid('last_deployment_id')->nullable()->constrained('deployments')->nullOnDelete());
        Schema::table('wordpress_connections', fn (Blueprint $table) => $table->timestamp('last_deployment_at')->nullable());

        Schema::create('deployment_rollback_snapshots', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('deployment_id')->unique()->constrained()->cascadeOnDelete();
            $table->json('snapshot');
            $table->string('checksum', 64);
            $table->timestamp('created_at')->useCurrent();
        });
        Schema::table('deployments', fn (Blueprint $table) => $table->foreign('rollback_snapshot_id')->references('id')->on('deployment_rollback_snapshots')->nullOnDelete());

        Schema::create('deployment_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('deployment_id')->constrained()->cascadeOnDelete();
            $table->string('stage');
            $table->string('resource_type');
            $table->string('resource_key');
            $table->string('operation');
            $table->string('status')->default('pending');
            $table->unsignedInteger('attempt')->default(0);
            $table->unsignedBigInteger('remote_id')->nullable();
            $table->string('remote_url', 2048)->nullable();
            $table->json('result')->nullable();
            $table->json('error')->nullable();
            $table->timestamps();
            $table->unique(['deployment_id', 'resource_type', 'resource_key', 'operation'], 'deployment_item_idempotency');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('deployment_items');
        Schema::table('deployments', fn (Blueprint $table) => $table->dropForeign(['rollback_snapshot_id']));
        Schema::dropIfExists('deployment_rollback_snapshots');
        Schema::table('wordpress_connections', fn (Blueprint $table) => $table->dropColumn('last_deployment_at'));
        Schema::table('projects', fn (Blueprint $table) => $table->dropConstrainedForeignId('last_deployment_id'));
        Schema::table('deployments', function (Blueprint $table) {
            $table->dropForeign(['deployment_plan_id']);
            $table->dropColumn(['deployment_plan_id', 'approval_checksum', 'idempotency_key', 'result_summary', 'error_details', 'rollback_snapshot_id', 'failed_at', 'cancelled_at']);
        });
    }
};
