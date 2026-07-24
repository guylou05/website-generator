<?php

namespace App\Support;

final class ApplicationKey
{
    public static function normalize(?string $key): ?string
    {
        if ($key === null || $key === '') {
            return $key;
        }

        if (strlen($key) === 32) {
            return $key;
        }

        if (str_starts_with($key, 'base64:')) {
            $decoded = base64_decode(substr($key, 7), true);

            if ($decoded !== false && strlen($decoded) === 32) {
                return $key;
            }
        }

        // Railway secrets are sometimes configured as ordinary text rather than
        // the value emitted by `artisan key:generate`. Derive a stable cipher key
        // instead of allowing every request (including /up) to fail at runtime.
        return 'base64:'.base64_encode(hash('sha256', $key, true));
    }
}
