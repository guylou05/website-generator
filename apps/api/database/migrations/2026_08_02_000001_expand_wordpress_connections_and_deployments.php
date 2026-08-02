<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('wordpress_connections', function (Blueprint $table) {
            $table->string('name')->default('WordPress site')->after('project_id');
            $table->string('authentication_type')->default('application_password')->after('site_url');
            $table->text('encrypted_connector_token')->nullable()->after('encrypted_application_password');
            $table->foreignUuid('created_by')->nullable()->constrained('users')->nullOnDelete();
        });
        Schema::table('deployments', function (Blueprint $table) {
            $table->json('options')->nullable();
            $table->foreignUuid('created_by')->nullable()->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('deployments', fn (Blueprint $table) => $table->dropConstrainedForeignId('created_by'));
        Schema::table('deployments', fn (Blueprint $table) => $table->dropColumn('options'));
        Schema::table('wordpress_connections', function (Blueprint $table) {
            $table->dropConstrainedForeignId('created_by');
            $table->dropColumn(['name', 'authentication_type', 'encrypted_connector_token']);
        });
    }
};
