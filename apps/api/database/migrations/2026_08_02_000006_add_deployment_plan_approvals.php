<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('deployment_plans', function (Blueprint $table) {
            $table->json('options')->nullable();
            $table->string('snapshot_hash', 64)->nullable();
            $table->string('revision_hash', 64)->nullable();
            $table->string('approval_checksum', 64)->nullable();
            $table->unsignedInteger('plan_version')->default(1);
            $table->json('acknowledged_warning_ids')->nullable();
            $table->text('approval_comment')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->foreignUuid('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('rejected_at')->nullable();
            $table->foreignUuid('rejected_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('rejection_reason')->nullable();
            $table->timestamp('expires_at')->nullable()->index();
            $table->timestamp('snapshot_captured_at')->nullable();
            $table->foreignUuid('superseded_by_id')->nullable()->constrained('deployment_plans')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('deployment_plans', function (Blueprint $table) {
            $table->dropForeign(['approved_by']);
            $table->dropForeign(['rejected_by']);
            $table->dropForeign(['superseded_by_id']);
            $table->dropColumn(['options', 'snapshot_hash', 'revision_hash', 'approval_checksum', 'plan_version', 'acknowledged_warning_ids', 'approval_comment', 'approved_at', 'approved_by', 'rejected_at', 'rejected_by', 'rejection_reason', 'expires_at', 'snapshot_captured_at', 'superseded_by_id']);
        });
    }
};
