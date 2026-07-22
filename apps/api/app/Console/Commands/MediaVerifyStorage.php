<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class MediaVerifyStorage extends Command
{
    protected $signature = 'media:verify-storage';

    protected $description = 'Verify private media storage';

    public function handle(): int
    {
        $key = '.health/'.bin2hex(random_bytes(12));
        Storage::disk(config('media.disk'))->put($key, 'ok', ['visibility' => 'private']);
        $ok = Storage::disk(config('media.disk'))->get($key) === 'ok';
        Storage::disk(config('media.disk'))->delete($key);
        $this->info($ok ? 'Media storage is writable.' : 'Media storage verification failed.');

        return $ok ? self::SUCCESS : self::FAILURE;
    }
}
