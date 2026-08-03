<?php

namespace Tests\Feature;

use App\Models\Deployment;
use App\Models\DeploymentSnapshotUpload;
use App\Models\DeploymentSnapshotUploadChunk;
use App\Models\Project;
use App\Rules\Base64Encoded;
use App\Rules\ValidUtf8;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Tests\TestCase;

class DeploymentSnapshotChunkTest extends TestCase
{
    use RefreshDatabase;

    public function test_raw_binary_is_rejected_when_supplied_to_the_text_transport_field(): void
    {
        $validator = Validator::make(
            ['data' => "\x1f\x8b\x08\x00\xff"],
            ['data' => ['required', 'string', new ValidUtf8, new Base64Encoded]],
        );

        $this->assertTrue($validator->fails());
        $this->assertStringContainsString('valid UTF-8', $validator->errors()->first('data'));
    }

    public function test_gzip_chunk_is_decoded_and_persisted_as_binary(): void
    {
        $gzip = gzencode('{"snapshot":true}');

        $chunk = $this->uploadChunk($gzip);

        $this->assertSame($gzip, $this->chunkBytes($chunk));
        $this->assertStringStartsWith("\x1f\x8b", $this->chunkBytes($chunk));
    }

    public function test_base64_chunk_is_accepted_and_decoded_before_persistence(): void
    {
        $chunk = $this->uploadChunk('plain snapshot bytes');

        $this->assertSame('plain snapshot bytes', $this->chunkBytes($chunk));
        $this->assertNotSame(base64_encode('plain snapshot bytes'), $this->chunkBytes($chunk));
    }

    public function test_snapshot_chunk_column_uses_binary_storage(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            $type = DB::table('information_schema.columns')
                ->where('table_schema', 'public')
                ->where('table_name', 'deployment_snapshot_upload_chunks')
                ->where('column_name', 'data')
                ->value('data_type');

            $this->assertSame('bytea', $type);

            return;
        }

        $column = collect(DB::select("PRAGMA table_info('deployment_snapshot_upload_chunks')"))
            ->firstWhere('name', 'data');
        $this->assertSame('BLOB', strtoupper($column->type));
    }

    private function uploadChunk(string $bytes): DeploymentSnapshotUploadChunk
    {
        config(['app.internal_worker_token' => 'test-worker-token']);
        $deployment = $this->deployment();
        $uploadId = hash('sha256', $deployment->id.':snapshot');
        DeploymentSnapshotUpload::create([
            'id' => $uploadId,
            'deployment_id' => $deployment->id,
            'manifest' => ['compressed_size' => strlen($bytes)],
            'created_at' => now(),
        ]);
        $checksum = hash('sha256', $bytes);

        $this->withToken('test-worker-token')->postJson(
            '/api/internal/deployments/'.$deployment->id.'/rollback-snapshot/chunks',
            ['lease_token' => str_repeat('a', 64), 'upload_id' => $uploadId, 'sequence' => 0, 'checksum' => $checksum, 'data' => base64_encode($bytes)],
        )->assertOk();

        return DeploymentSnapshotUploadChunk::sole();
    }

    private function deployment(): Deployment
    {
        $project = Project::create(['name' => 'Snapshot', 'slug' => 'snapshot', 'status' => 'ready', 'business_profile' => []]);
        $run = $project->generationRuns()->create(['provider' => 'test', 'status' => 'completed', 'input' => []]);
        $connection = $project->wordpressConnections()->create(['site_url' => 'https://wordpress.test']);

        return $project->deployments()->create([
            'organization_id' => $project->organization_id,
            'generation_run_id' => $run->id,
            'wordpress_connection_id' => $connection->id,
            'status' => 'running',
            'lease_token' => str_repeat('a', 64),
            'dry_run' => false,
        ]);
    }

    private function chunkBytes(DeploymentSnapshotUploadChunk $chunk): string
    {
        return is_resource($chunk->data) ? stream_get_contents($chunk->data) : $chunk->data;
    }
}
