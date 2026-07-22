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
                $blueprint->timestamp('queued_at')->nullable();
                $blueprint->timestamp('heartbeat_at')->nullable();
                $blueprint->timestamp('cancellation_requested_at')->nullable();
                $blueprint->unsignedInteger('attempt')->default(1);
                $blueprint->unsignedInteger('max_attempts')->default(3);
                $blueprint->string('worker_id')->nullable();
            });
        }
        Schema::table('generation_events', fn (Blueprint $table) => $table->uuid('event_uuid')->nullable()->unique());
        Schema::table('deployment_events', fn (Blueprint $table) => $table->uuid('event_uuid')->nullable()->unique());
        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE generation_runs ADD CONSTRAINT generation_runs_status_check CHECK (status IN ('queued','running','cancelling','cancelled','succeeded','failed','stale'))");
            DB::statement("ALTER TABLE deployments ADD CONSTRAINT deployments_status_check CHECK (status IN ('queued','running','cancelling','cancelled','succeeded','failed','stale'))");
            DB::statement("CREATE UNIQUE INDEX deployments_one_active_live_per_project ON deployments (project_id) WHERE dry_run = false AND status IN ('queued','running','cancelling')");
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('DROP INDEX IF EXISTS deployments_one_active_live_per_project');
            DB::statement('ALTER TABLE generation_runs DROP CONSTRAINT IF EXISTS generation_runs_status_check');
            DB::statement('ALTER TABLE deployments DROP CONSTRAINT IF EXISTS deployments_status_check');
        }
        Schema::table('generation_events', fn (Blueprint $table) => $table->dropColumn('event_uuid'));
        Schema::table('deployment_events', fn (Blueprint $table) => $table->dropColumn('event_uuid'));
        foreach (['generation_runs', 'deployments'] as $table) {
            Schema::table($table, fn (Blueprint $blueprint) => $blueprint->dropColumn(['queued_at', 'heartbeat_at', 'cancellation_requested_at', 'attempt', 'max_attempts', 'worker_id']));
        }
    }
};
