<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('website_revisions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('project_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('generation_run_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignUuid('parent_revision_id')->nullable()->constrained('website_revisions')->nullOnDelete();
            $table->unsignedInteger('revision_number');
            $table->string('status', 24)->default('draft');
            $table->string('source', 32);
            $table->json('blueprint');
            $table->json('elementor_output')->nullable();
            $table->json('validation')->nullable();
            $table->json('change_summary')->nullable();
            $table->foreignUuid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignUuid('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();
            $table->unique(['project_id', 'revision_number']);
            $table->index(['project_id', 'status']);
        });
        Schema::table('projects', fn (Blueprint $table) => $table->foreignUuid('approved_revision_id')->nullable()->constrained('website_revisions')->nullOnDelete());

        Schema::create('revision_changes', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('website_revision_id')->constrained()->cascadeOnDelete();
            $table->string('page_id')->nullable();
            $table->string('section_id')->nullable();
            $table->string('field_path');
            $table->string('change_type');
            $table->json('old_value')->nullable();
            $table->json('new_value')->nullable();
            $table->string('actor_type');
            $table->uuid('actor_id')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->index(['website_revision_id', 'created_at']);
        });
        Schema::create('preview_sessions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('project_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('website_revision_id')->constrained()->cascadeOnDelete();
            $table->string('token_hash', 64)->unique();
            $table->timestamp('expires_at');
            $table->timestamp('revoked_at')->nullable();
            $table->foreignUuid('created_by')->constrained('users')->cascadeOnDelete();
            $table->timestamp('created_at')->useCurrent();
        });
        Schema::create('revision_proposals', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('project_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('website_revision_id')->constrained()->cascadeOnDelete();
            $table->string('job_type');
            $table->string('target_path');
            $table->string('status')->default('queued');
            $table->json('input');
            $table->json('proposed_value')->nullable();
            $table->json('error')->nullable();
            $table->string('provider');
            $table->string('model')->nullable();
            $table->foreignUuid('created_by')->constrained('users')->cascadeOnDelete();
            $table->timestamp('accepted_at')->nullable();
            $table->timestamp('rejected_at')->nullable();
            $table->timestamps();
        });
        Schema::table('deployments', fn (Blueprint $table) => $table->foreignUuid('website_revision_id')->nullable()->constrained()->nullOnDelete());
    }

    public function down(): void
    {
        Schema::table('deployments', fn (Blueprint $table) => $table->dropConstrainedForeignId('website_revision_id'));
        Schema::dropIfExists('revision_proposals');
        Schema::dropIfExists('preview_sessions');
        Schema::dropIfExists('revision_changes');
        Schema::table('projects', fn (Blueprint $table) => $table->dropConstrainedForeignId('approved_revision_id'));
        Schema::dropIfExists('website_revisions');
    }
};
