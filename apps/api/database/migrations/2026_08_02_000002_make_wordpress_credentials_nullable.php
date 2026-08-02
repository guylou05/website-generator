<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('wordpress_connections', function (Blueprint $table) {
            $table->string('username')->nullable()->change();
            $table->text('encrypted_application_password')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('wordpress_connections', function (Blueprint $table) {
            $table->string('username')->nullable(false)->change();
            $table->text('encrypted_application_password')->nullable(false)->change();
        });
    }
};
