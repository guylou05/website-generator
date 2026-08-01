<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('first_name')->nullable()->after('name');
            $table->string('last_name')->nullable()->after('first_name');
            $table->string('timezone')->nullable();
            $table->string('locale', 16)->nullable();
            $table->string('appearance', 16)->default('system');
            $table->json('notification_preferences')->nullable();
            $table->foreignUuid('avatar_media_asset_id')->nullable()->constrained('media_assets')->nullOnDelete();
        });

        Schema::table('organizations', function (Blueprint $table) {
            $table->string('billing_email')->nullable();
            $table->string('company_website')->nullable();
            $table->string('industry')->nullable();
            $table->string('timezone')->nullable();
            $table->json('address')->nullable();
            $table->foreignUuid('logo_media_asset_id')->nullable()->constrained('media_assets')->nullOnDelete();
        });

        Schema::table('deployments', fn (Blueprint $table) => $table->index(['organization_id', 'created_at']));
        Schema::table('generation_runs', fn (Blueprint $table) => $table->index(['organization_id', 'created_at']));
    }

    public function down(): void
    {
        Schema::table('deployments', fn (Blueprint $table) => $table->dropIndex(['organization_id', 'created_at']));
        Schema::table('generation_runs', fn (Blueprint $table) => $table->dropIndex(['organization_id', 'created_at']));
        Schema::table('organizations', fn (Blueprint $table) => $table->dropColumn(['billing_email', 'company_website', 'industry', 'timezone', 'address', 'logo_media_asset_id']));
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn(['first_name', 'last_name', 'timezone', 'locale', 'appearance', 'notification_preferences', 'avatar_media_asset_id']));
    }
};
