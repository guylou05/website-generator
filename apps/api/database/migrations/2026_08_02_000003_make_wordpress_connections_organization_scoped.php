<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->foreignUuid('default_wordpress_connection_id')->nullable();
        });

        // Keep the legacy association long enough to select a sensible default. Connections
        // themselves are organization resources from this point forward.
        DB::table('wordpress_connections')->whereNull('organization_id')->orderBy('created_at')->each(function ($connection) {
            $organizationId = DB::table('projects')->where('id', $connection->project_id)->value('organization_id');
            if ($organizationId) {
                DB::table('wordpress_connections')->where('id', $connection->id)->update(['organization_id' => $organizationId]);
            }
        });
        DB::table('wordpress_connections')->whereNotNull('project_id')->orderBy('created_at')->each(function ($connection) {
            DB::table('projects')->where('id', $connection->project_id)->whereNull('default_wordpress_connection_id')->update(['default_wordpress_connection_id' => $connection->id]);
        });

        Schema::table('wordpress_connections', function (Blueprint $table) {
            $table->dropForeign(['project_id']);
            $table->uuid('project_id')->nullable()->change();
        });
        Schema::table('projects', function (Blueprint $table) {
            $table->foreign('default_wordpress_connection_id')->references('id')->on('wordpress_connections')->nullOnDelete();
        });

        // Deployment history owns the reference, so deleting a connection with history is rejected.
        Schema::table('deployments', function (Blueprint $table) {
            $table->dropForeign(['wordpress_connection_id']);
            $table->foreign('wordpress_connection_id')->references('id')->on('wordpress_connections')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('deployments', function (Blueprint $table) {
            $table->dropForeign(['wordpress_connection_id']);
            $table->foreign('wordpress_connection_id')->references('id')->on('wordpress_connections')->cascadeOnDelete();
        });
        Schema::table('projects', function (Blueprint $table) {
            $table->dropForeign(['default_wordpress_connection_id']);
            $table->dropColumn('default_wordpress_connection_id');
        });
    }
};
