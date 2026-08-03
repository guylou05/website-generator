<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        $type = DB::table('information_schema.columns')
            ->where('table_schema', 'public')
            ->where('table_name', 'deployment_snapshot_upload_chunks')
            ->where('column_name', 'data')
            ->value('data_type');

        if ($type !== 'bytea') {
            // Preserve any valid text rows from an affected deployment while changing
            // future writes to accept arbitrary compressed bytes.
            DB::statement("ALTER TABLE deployment_snapshot_upload_chunks ALTER COLUMN data TYPE BYTEA USING convert_to(data, 'UTF8')");
        }
    }

    public function down(): void
    {
        // Binary chunks cannot be losslessly converted back to a UTF-8 text column.
    }
};
