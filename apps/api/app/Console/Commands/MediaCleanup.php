<?php

namespace App\Console\Commands;

use App\Models\MediaAsset;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class MediaCleanup extends Command
{
    protected $signature = 'media:cleanup {--dry-run}';

    protected $description = 'Permanently remove expired, unreferenced soft-deleted media';

    public function handle(): int
    {
        $assets = MediaAsset::onlyTrashed()->where('deleted_at', '<', now()->subDays(config('media.retention_days')))->whereDoesntHave('usages')->get();
        foreach ($assets as $asset) {
            $this->line(($this->option('dry-run') ? 'Would delete ' : 'Deleting ').$asset->id);
            if (! $this->option('dry-run')) {
                Storage::disk($asset->storage_disk)->delete(array_merge([$asset->storage_key], $asset->variants()->pluck('storage_key')->all()));
                $asset->forceDelete();
            }
        }

        return self::SUCCESS;
    }
}
