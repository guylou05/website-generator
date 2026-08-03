<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('deployments', function (Blueprint $table) {
            $table->foreignUuid('parent_deployment_id')->nullable()->constrained('deployments')->nullOnDelete();
            $table->foreignUuid('retry_of_id')->nullable()->constrained('deployments')->nullOnDelete();
            $table->unsignedInteger('attempt_number')->default(1);
            $table->foreignUuid('initiated_by')->nullable()->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('deployments', function (Blueprint $table) {
            $table->dropConstrainedForeignId('parent_deployment_id');
            $table->dropConstrainedForeignId('retry_of_id');
            $table->dropConstrainedForeignId('initiated_by');
            $table->dropColumn('attempt_number');
        });
    }
};
