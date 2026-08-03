<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const STATUSES = ['queued', 'claimed', 'running', 'succeeded', 'failed', 'partially_succeeded', 'cancelling', 'cancelled', 'completed', 'stale'];

    public function up(): void
    {
        $unsupported = DB::table('deployments')->whereNotIn('status', self::STATUSES)->distinct()->pluck('status')->all();
        if ($unsupported !== []) {
            throw new RuntimeException('Unsupported deployment statuses must be migrated before applying the constraint: '.implode(', ', $unsupported));
        }

        DB::statement('ALTER TABLE deployments DROP CONSTRAINT IF EXISTS deployments_status_check');
        DB::statement("ALTER TABLE deployments ADD CONSTRAINT deployments_status_check CHECK (status IN ('queued','claimed','running','succeeded','failed','partially_succeeded','cancelling','cancelled','completed','stale'))");
        DB::statement('DROP INDEX IF EXISTS deployments_one_active_live_per_project');
        DB::statement("CREATE UNIQUE INDEX deployments_one_active_live_per_project ON deployments (project_id) WHERE dry_run = false AND status IN ('queued','claimed','running','cancelling')");
    }

    public function down(): void
    {
        $unsupported = DB::table('deployments')->whereNotIn('status', ['queued', 'running', 'cancelling', 'cancelled', 'succeeded', 'failed', 'stale'])->exists();
        if ($unsupported) {
            throw new RuntimeException('Cannot restore the previous constraint while newer deployment statuses exist.');
        }
        DB::statement('ALTER TABLE deployments DROP CONSTRAINT IF EXISTS deployments_status_check');
        DB::statement("ALTER TABLE deployments ADD CONSTRAINT deployments_status_check CHECK (status IN ('queued','running','cancelling','cancelled','succeeded','failed','stale'))");
        DB::statement('DROP INDEX IF EXISTS deployments_one_active_live_per_project');
        DB::statement("CREATE UNIQUE INDEX deployments_one_active_live_per_project ON deployments (project_id) WHERE dry_run = false AND status IN ('queued','running','cancelling')");
    }
};
