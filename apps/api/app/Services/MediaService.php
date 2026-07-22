<?php

namespace App\Services;

use App\Models\MediaAsset;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class MediaService
{
    public function initiate(array $input, string $organizationId, string $userId): array
    {
        $disk = config('media.disk');
        $extension = config('media.allowed_mimes')[$input['mime_type']] ?? throw ValidationException::withMessages(['mime_type' => ['Unsupported image type.']]);
        $limit = config('media.max_upload_mb') * 1024 * 1024;
        if ($input['size_bytes'] > $limit) {
            throw ValidationException::withMessages(['size_bytes' => ['Upload exceeds the configured limit.']]);
        }
        $key = sprintf('organizations/%s/originals/%s/%s.%s', $organizationId, now()->format('Y/m'), Str::random(48), $extension);
        $asset = MediaAsset::create([
            'organization_id' => $organizationId, 'project_id' => $input['project_id'] ?? null, 'uploaded_by' => $userId,
            'source_type' => $input['source_type'] ?? 'upload', 'status' => 'pending_upload', 'original_filename' => basename($input['filename']),
            'display_name' => $input['display_name'] ?? pathinfo($input['filename'], PATHINFO_FILENAME), 'mime_type' => $input['mime_type'],
            'extension' => $extension, 'size_bytes' => $input['size_bytes'], 'storage_disk' => $disk, 'storage_key' => $key,
        ]);
        $upload = Storage::disk($disk)->temporaryUploadUrl($key, now()->addSeconds(config('media.signed_url_ttl')), [
            'ContentType' => $input['mime_type'], 'ContentLength' => $input['size_bytes'],
        ]);

        return [$asset, ['url' => $upload['url'], 'headers' => $upload['headers'] ?? [], 'expires_at' => now()->addSeconds(config('media.signed_url_ttl'))->toIso8601String()]];
    }

    public function complete(MediaAsset $asset): MediaAsset
    {
        abort_unless($asset->status === 'pending_upload', 409, 'Upload is not pending.');
        $storage = Storage::disk($asset->storage_disk);
        abort_unless($storage->exists($asset->storage_key), 422, 'Uploaded object was not found.');
        $path = tempnam(sys_get_temp_dir(), 'media-');
        $input = $storage->readStream($asset->storage_key);
        $output = fopen($path, 'wb');
        stream_copy_to_stream($input, $output);
        fclose($input);
        fclose($output);
        try {
            $size = filesize($path);
            $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($path);
            $dimensions = @getimagesize($path);
            $expectedExtension = config('media.allowed_mimes')[$mime] ?? null;
            if (! $expectedExtension || ! $dimensions || $mime !== $asset->mime_type) {
                $this->reject($asset, 'The uploaded file is not a valid image of the declared type.');
            }
            if ($size > config('media.max_upload_mb') * 1024 * 1024 || ($dimensions[0] * $dimensions[1]) > config('media.max_pixels')) {
                $this->reject($asset, 'The image exceeds safe processing limits.');
            }
            $asset->update(['status' => 'uploaded', 'size_bytes' => $size, 'width' => $dimensions[0], 'height' => $dimensions[1],
                'aspect_ratio' => round($dimensions[0] / $dimensions[1], 6), 'checksum_sha256' => hash_file('sha256', $path),
                'metadata' => ['processing' => ['stage' => 'verify_upload', 'progress' => 10]]]);
        } finally {
            @unlink($path);
        }

        // A trusted worker advances uploaded -> scanning -> processing -> ready.
        return $asset->fresh();
    }

    private function reject(MediaAsset $asset, string $message): never
    {
        $asset->update(['status' => 'rejected', 'metadata' => ['failure' => ['code' => 'unsafe_image', 'message' => $message]]]);
        throw ValidationException::withMessages(['upload' => [$message]]);
    }

    public function resource(MediaAsset $asset): array
    {
        $url = null;
        if (! in_array($asset->status, ['rejected', 'deleted', 'pending_upload'], true) && Storage::disk($asset->storage_disk)->exists($asset->storage_key)) {
            $url = Storage::disk($asset->storage_disk)->temporaryUrl($asset->storage_key, now()->addSeconds(config('media.signed_url_ttl')));
        }

        return collect($asset->only(['id', 'organization_id', 'project_id', 'source_type', 'status', 'display_name', 'description', 'alt_text', 'caption', 'mime_type', 'extension', 'size_bytes', 'width', 'height', 'aspect_ratio', 'dominant_color', 'provider', 'provider_attribution', 'parent_asset_id', 'created_at', 'updated_at', 'deleted_at']))->put('url', $url)->all();
    }
}
