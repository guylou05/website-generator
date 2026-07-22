<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('email')->unique();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password');
            $table->uuid('current_organization_id')->nullable();
            $table->timestamp('last_login_at')->nullable();
            $table->rememberToken();
            $table->timestamps();
        });
        Schema::create('organizations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('slug')->unique();
            $table->foreignUuid('owner_user_id')->constrained('users')->restrictOnDelete();
            $table->timestamps();
        });
        Schema::table('users', fn (Blueprint $table) => $table->foreign('current_organization_id')->references('id')->on('organizations')->nullOnDelete());
        Schema::create('organization_memberships', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $table->enum('role', ['owner', 'admin', 'member', 'viewer']);
            $table->string('status')->default('active');
            $table->foreignUuid('invited_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('joined_at')->nullable();
            $table->timestamps();
            $table->unique(['organization_id', 'user_id']);
        });
        Schema::create('organization_invitations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained()->cascadeOnDelete();
            $table->string('email');
            $table->enum('role', ['admin', 'member', 'viewer']);
            $table->string('token_hash', 64)->unique();
            $table->foreignUuid('invited_by')->constrained('users')->cascadeOnDelete();
            $table->timestamp('expires_at');
            $table->timestamp('accepted_at')->nullable();
            $table->timestamp('revoked_at')->nullable();
            $table->timestamps();
            $table->index(['organization_id', 'email']);
        });
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->nullable()->constrained()->nullOnDelete();
            $table->string('actor_type');
            $table->uuid('actor_id')->nullable();
            $table->string('action');
            $table->string('auditable_type');
            $table->uuid('auditable_id')->nullable();
            $table->json('metadata')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->index(['organization_id', 'created_at']);
        });
        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });

        $userId = (string) Str::uuid();
        $organizationId = (string) Str::uuid();
        DB::table('users')->insert(['id' => $userId, 'name' => 'Legacy Owner', 'email' => 'legacy-owner@localhost.invalid', 'password' => Hash::make(Str::random(64)), 'created_at' => now(), 'updated_at' => now()]);
        DB::table('organizations')->insert(['id' => $organizationId, 'name' => 'Default Organization', 'slug' => 'default-'.Str::lower(Str::random(6)), 'owner_user_id' => $userId, 'created_at' => now(), 'updated_at' => now()]);
        DB::table('users')->where('id', $userId)->update(['current_organization_id' => $organizationId]);
        DB::table('organization_memberships')->insert(['id' => (string) Str::uuid(), 'organization_id' => $organizationId, 'user_id' => $userId, 'role' => 'owner', 'status' => 'active', 'joined_at' => now(), 'created_at' => now(), 'updated_at' => now()]);

        foreach (['projects', 'generation_runs', 'wordpress_connections', 'deployments'] as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->uuid('organization_id')->nullable()->index();
            });
            DB::table($tableName)->update(['organization_id' => $organizationId]);
            Schema::table($tableName, function (Blueprint $table) {
                $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();
            });
        }
        if (DB::getDriverName() === 'pgsql') {
            foreach (['projects', 'generation_runs', 'wordpress_connections', 'deployments'] as $tableName) {
                DB::statement("ALTER TABLE {$tableName} ALTER COLUMN organization_id SET NOT NULL");
            }
        }
        Schema::table('projects', function (Blueprint $table) {
            $table->dropUnique(['slug']);
            $table->unique(['organization_id', 'slug']);
        });
    }

    public function down(): void
    {
        Schema::table('projects', fn (Blueprint $table) => $table->dropUnique(['organization_id', 'slug']));
        foreach (['deployments', 'wordpress_connections', 'generation_runs', 'projects'] as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->dropConstrainedForeignId('organization_id');
            });
        }
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('organization_invitations');
        Schema::dropIfExists('organization_memberships');
        Schema::table('users', fn (Blueprint $table) => $table->dropForeign(['current_organization_id']));
        Schema::dropIfExists('organizations');
        Schema::dropIfExists('users');
    }
};
