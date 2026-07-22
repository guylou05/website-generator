<?php

namespace App\Console\Commands;

use App\Models\MediaAsset;
use Illuminate\Console\Command;

class MediaMaintenance extends Command
{
    protected $signature = 'media:inspect {asset?} {--organization=}';

    protected $description = 'Inspect retained media without exposing object keys';

    public function handle(): int
    {
        $query = MediaAsset::withTrashed()->withCount(['variants', 'usages']);
        $query->when($this->argument('asset'), fn ($q, $id) => $q->whereKey($id));
        $query->when($this->option('organization'), fn ($q, $id) => $q->where('organization_id', $id));
        $this->table(['id', 'organization', 'status', 'bytes', 'variants', 'usages'], $query->limit(200)->get()->map(fn ($asset) => [$asset->id, $asset->organization_id, $asset->status, $asset->size_bytes, $asset->variants_count, $asset->usages_count]));

        return self::SUCCESS;
    }
}
