<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('deployment_rollback_snapshots', function (Blueprint $table) {
            $table->string('artifact_path')->nullable();
            $table->unsignedBigInteger('uncompressed_size')->nullable();
            $table->unsignedBigInteger('compressed_size')->nullable();
            $table->string('content_type')->nullable();
            $table->string('content_encoding')->nullable();
            $table->string('schema_version', 20)->nullable();
            $table->json('manifest')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('deployment_rollback_snapshots', fn (Blueprint $table) => $table->dropColumn(['artifact_path', 'uncompressed_size', 'compressed_size', 'content_type', 'content_encoding', 'schema_version', 'manifest']));
    }
};
