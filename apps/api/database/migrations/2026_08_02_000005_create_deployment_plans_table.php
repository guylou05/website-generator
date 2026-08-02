<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('deployment_plans', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('project_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('website_revision_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('wordpress_connection_id')->constrained()->restrictOnDelete();
            $table->string('status')->default('ready');
            $table->string('safety_status')->default('safe');
            $table->json('snapshot');
            $table->json('changes');
            $table->json('statistics');
            $table->json('warnings');
            $table->unsignedInteger('estimated_seconds')->default(0);
            $table->foreignUuid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['project_id', 'created_at']);
        });
    }
    public function down(): void { Schema::dropIfExists('deployment_plans'); }
};
