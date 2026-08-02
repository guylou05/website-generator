<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('wordpress_connections', fn (Blueprint $table) => $table->timestamp('last_tested_at')->nullable()->after('last_verified_at'));
    }

    public function down(): void
    {
        Schema::table('wordpress_connections', fn (Blueprint $table) => $table->dropColumn('last_tested_at'));
    }
};
