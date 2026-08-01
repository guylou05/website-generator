<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

class MediaDiagnose extends Command
{
    protected $signature = 'media:diagnose';

    protected $description = 'Validate media provider configuration';

    public function handle(): int
    {
        try {
            $disk = Storage::disk(config('filesystems.default'));
            $path = '.sitefoundry-diagnostic-'.Str::uuid();
            $disk->put($path, 'ok');
            $disk->get($path);
            $disk->delete($path);
        } catch (Throwable) {
            $this->error('Storage write/read/delete verification failed. See logs for the diagnostic reference.');

            return self::FAILURE;
        }
        $this->info('Storage lifecycle verified on '.config('filesystems.default').'.');

        return self::SUCCESS;
    }
}
