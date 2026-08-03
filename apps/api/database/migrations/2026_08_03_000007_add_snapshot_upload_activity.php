<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('deployment_snapshot_uploads', function (Blueprint $table) {
            $table->timestamp('updated_at')->nullable()->index();
        });
    }

    public function down(): void
    {
        Schema::table('deployment_snapshot_uploads', fn (Blueprint $table) => $table->dropColumn('updated_at'));
    }
};
