<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('deployment_snapshot_uploads', function (Blueprint $table) {
            $table->string('id', 64)->primary();
            $table->foreignUuid('deployment_id')->unique()->constrained('deployments')->cascadeOnDelete();
            $table->json('manifest');
            $table->timestamp('created_at');
        });
        Schema::create('deployment_snapshot_upload_chunks', function (Blueprint $table) {
            $table->id();
            $table->string('upload_id', 64);
            $table->unsignedInteger('sequence');
            $table->string('checksum', 64);
            $table->binary('data');
            $table->foreign('upload_id')->references('id')->on('deployment_snapshot_uploads')->cascadeOnDelete();
            $table->unique(['upload_id', 'sequence']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('deployment_snapshot_upload_chunks');
        Schema::dropIfExists('deployment_snapshot_uploads');
    }
};
