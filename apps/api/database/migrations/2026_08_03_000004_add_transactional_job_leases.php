<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        foreach (['generation_runs', 'deployments'] as $table) {
            Schema::table($table, function (Blueprint $blueprint) {
                $blueprint->string('claimed_by_worker_id')->nullable();
                $blueprint->string('lease_token', 64)->nullable();
                $blueprint->timestamp('lease_expires_at')->nullable()->index();
                $blueprint->unsignedInteger('queue_delivery_count')->default(0);
                $blueprint->unsignedInteger('recovery_count')->default(0);
                $blueprint->unsignedInteger('transient_retry_count')->default(0);
                $blueprint->string('completion_idempotency_key')->nullable();
                $blueprint->string('completion_checksum', 64)->nullable();
            });
        }

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE generation_runs DROP CONSTRAINT IF EXISTS generation_runs_status_check');
            DB::statement("ALTER TABLE generation_runs ADD CONSTRAINT generation_runs_status_check CHECK (status IN ('queued','claimed','running','cancelling','cancelled','succeeded','failed','stale'))");
        }
    }

    public function down(): void
    {
        foreach (['generation_runs', 'deployments'] as $table) {
            Schema::table($table, fn (Blueprint $blueprint) => $blueprint->dropColumn([
                'claimed_by_worker_id', 'lease_token', 'lease_expires_at', 'queue_delivery_count',
                'recovery_count', 'transient_retry_count', 'completion_idempotency_key', 'completion_checksum',
            ]));
        }
    }
};
