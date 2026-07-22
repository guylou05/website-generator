<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('media_assets', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->uuid('organization_id')->index();
            $t->uuid('project_id')->nullable()->index();
            $t->uuid('uploaded_by')->nullable();
            $t->string('source_type')->index();
            $t->string('status')->index();
            $t->string('original_filename')->nullable();
            $t->string('display_name');
            $t->text('description')->nullable();
            $t->text('alt_text')->nullable();
            $t->text('caption')->nullable();
            $t->string('mime_type');
            $t->string('extension', 12);
            $t->unsignedBigInteger('size_bytes')->default(0);
            $t->unsignedInteger('width')->nullable();
            $t->unsignedInteger('height')->nullable();
            $t->decimal('aspect_ratio', 10, 6)->nullable();
            $t->string('dominant_color', 16)->nullable();
            $t->string('storage_disk');
            $t->string('storage_key')->unique();
            $t->string('checksum_sha256', 64)->nullable()->index();
            $t->json('metadata')->nullable();
            $t->string('provider')->nullable();
            $t->string('provider_asset_id')->nullable();
            $t->json('provider_attribution')->nullable();
            $t->uuid('parent_asset_id')->nullable()->index();
            $t->timestamps();
            $t->softDeletes();
            $t->index(['organization_id', 'project_id', 'created_at']);
            $t->index(['organization_id', 'source_type', 'status']);
        });
        Schema::create('media_variants', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->uuid('organization_id')->index();
            $t->uuid('media_asset_id')->index();
            $t->string('variant_key');
            $t->string('mime_type');
            $t->string('extension', 12);
            $t->unsignedBigInteger('size_bytes');
            $t->unsignedInteger('width');
            $t->unsignedInteger('height');
            $t->string('storage_disk');
            $t->string('storage_key')->unique();
            $t->string('checksum_sha256', 64);
            $t->json('processing_metadata')->nullable();
            $t->timestamps();
            $t->unique(['media_asset_id', 'variant_key', 'mime_type']);
        });
        Schema::create('media_usages', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->uuid('organization_id')->index();
            $t->uuid('media_asset_id')->index();
            $t->uuid('project_id')->index();
            $t->uuid('website_revision_id')->nullable()->index();
            $t->string('page_id')->nullable();
            $t->string('section_id')->nullable();
            $t->string('field_path');
            $t->string('usage_type');
            $t->timestamps();
            $t->unique(['website_revision_id', 'field_path']);
        });
        Schema::create('image_generation_jobs', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->uuid('organization_id')->index();
            $t->uuid('project_id')->index();
            $t->uuid('website_revision_id')->nullable();
            $t->uuid('requested_by');
            $t->string('status')->index();
            $t->string('provider');
            $t->string('model')->nullable();
            $t->text('prompt');
            $t->text('negative_prompt')->nullable();
            $t->string('style_preset')->nullable();
            $t->string('aspect_ratio');
            $t->unsignedSmallInteger('requested_count');
            $t->unsignedSmallInteger('generated_count')->default(0);
            $t->uuid('input_asset_id')->nullable();
            $t->string('target_page_id')->nullable();
            $t->string('target_section_id')->nullable();
            $t->string('target_field_path')->nullable();
            $t->json('error')->nullable();
            $t->timestamp('queued_at')->nullable();
            $t->timestamp('started_at')->nullable();
            $t->timestamp('completed_at')->nullable();
            $t->timestamp('canceled_at')->nullable();
            $t->timestamps();
        });
        Schema::create('image_generation_results', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->uuid('organization_id')->index();
            $t->uuid('image_generation_job_id')->index();
            $t->uuid('media_asset_id')->index();
            $t->unsignedSmallInteger('position');
            $t->json('provider_metadata')->nullable();
            $t->timestamp('created_at')->useCurrent();
            $t->unique(['image_generation_job_id', 'position']);
        });
        Schema::create('stock_asset_references', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->uuid('organization_id')->index();
            $t->uuid('project_id')->nullable();
            $t->string('provider');
            $t->string('provider_asset_id');
            $t->text('thumbnail_url');
            $t->text('preview_url')->nullable();
            $t->string('photographer_name')->nullable();
            $t->text('photographer_url')->nullable();
            $t->text('source_url')->nullable();
            $t->text('attribution_text')->nullable();
            $t->unsignedInteger('width')->nullable();
            $t->unsignedInteger('height')->nullable();
            $t->json('metadata')->nullable();
            $t->uuid('imported_media_asset_id')->nullable();
            $t->timestamps();
            $t->unique(['organization_id', 'provider', 'provider_asset_id']);
        });
        Schema::create('brand_kits', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->uuid('organization_id')->index();
            $t->uuid('project_id')->nullable()->index();
            $t->string('name');
            $t->boolean('is_default')->default(false);
            $t->uuid('primary_logo_asset_id')->nullable();
            $t->uuid('secondary_logo_asset_id')->nullable();
            $t->uuid('favicon_asset_id')->nullable();
            $t->string('primary_color', 16);
            $t->string('secondary_color', 16)->nullable();
            $t->string('accent_color', 16)->nullable();
            $t->json('neutral_colors')->nullable();
            $t->string('heading_font')->nullable();
            $t->string('body_font')->nullable();
            $t->json('image_style')->nullable();
            $t->uuid('created_by');
            $t->timestamps();
        });
        Schema::create('brand_assets', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->uuid('organization_id')->index();
            $t->uuid('brand_kit_id')->index();
            $t->uuid('media_asset_id')->index();
            $t->string('asset_role');
            $t->timestamp('created_at')->useCurrent();
            $t->unique(['brand_kit_id', 'media_asset_id', 'asset_role']);
        });
        Schema::create('wordpress_media_mappings', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->uuid('organization_id')->index();
            $t->uuid('wordpress_connection_id')->index();
            $t->uuid('media_asset_id')->index();
            $t->uuid('media_variant_id')->nullable();
            $t->unsignedBigInteger('wordpress_attachment_id');
            $t->text('wordpress_url');
            $t->string('checksum_sha256', 64);
            $t->timestamp('last_synced_at');
            $t->json('metadata')->nullable();
            $t->timestamps();
            $t->unique(['wordpress_connection_id', 'media_asset_id', 'media_variant_id'], 'wordpress_media_mapping_unique');
        });
    }

    public function down(): void
    {
        foreach (['wordpress_media_mappings', 'brand_assets', 'brand_kits', 'stock_asset_references', 'image_generation_results', 'image_generation_jobs', 'media_usages', 'media_variants', 'media_assets'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
