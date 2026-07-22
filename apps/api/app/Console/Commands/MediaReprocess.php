<?php

namespace App\Console\Commands;

use App\Models\MediaAsset;
use Illuminate\Console\Command;

class MediaReprocess extends Command
{
    protected $signature = 'media:reprocess {asset}';

    protected $description = 'Queue a media asset for idempotent reprocessing';

    public function handle(): int
    {
        $asset = MediaAsset::withTrashed()->findOrFail($this->argument('asset'));
        $asset->update(['status' => 'processing', 'metadata' => array_merge($asset->metadata ?? [], ['processing' => ['stage' => 'verify_upload', 'progress' => 0]])]);
        $this->info('Asset queued for processing.');

        return self::SUCCESS;
    }
}
