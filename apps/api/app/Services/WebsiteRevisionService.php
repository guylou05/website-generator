<?php

namespace App\Services;

use App\Models\Project;
use App\Models\RevisionChange;
use App\Models\WebsiteRevision;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class WebsiteRevisionService
{
    private const EDITABLE = '/^(branding\.(name|tagline|colors\.(primary|secondary|accent|background|text)|typography\.(bodyFont|headingFont))|business\.(phone|email|address|hours|socialLinks)(\..+)?|navigation\.items\.\d+\.(label|href)|pages\.\d+\.(title|seo\.(title|description)|sections\.\d+\.(hidden|label|components\.\d+\.(text|label|href|name|description|question|answer|items|fields)(\..+)?))|footer\..+|globalStyles\.(headingScale|borderRadius|buttonStyle|sectionSpacing|contentWidth|headerLayout|footerLayout|backgroundColor|textColor))$/';

    private const FONTS = ['Inter', 'Arial', 'Georgia', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Merriweather', 'system-ui'];

    public function create(Project $project, array $blueprint, string $source = 'manual_edit', ?WebsiteRevision $parent = null, ?string $generationRunId = null): WebsiteRevision
    {
        return DB::transaction(function () use ($project, $blueprint, $source, $parent, $generationRunId) {
            $number = ((int) WebsiteRevision::where('project_id', $project->id)->lockForUpdate()->max('revision_number')) + 1;
            $revision = WebsiteRevision::create(['organization_id' => $project->organization_id, 'project_id' => $project->id, 'generation_run_id' => $generationRunId, 'parent_revision_id' => $parent?->id, 'revision_number' => $number, 'status' => 'draft', 'source' => $source, 'blueprint' => $this->normalize($blueprint), 'created_by' => auth()->id()]);
            $this->audit('revision.created', $revision);

            return $revision;
        }, 3);
    }

    public function clone(WebsiteRevision $revision, string $source = 'manual_edit'): WebsiteRevision
    {
        $copy = $this->create($revision->project, $revision->blueprint, $source, $revision, $revision->generation_run_id);
        $this->audit('revision.cloned', $copy, ['parent_revision_id' => $revision->id]);

        return $copy;
    }

    public function patch(WebsiteRevision $revision, array $operations, string $expectedUpdatedAt): WebsiteRevision
    {
        if ($revision->status !== 'draft') {
            $revision = $this->clone($revision);
        }
        if ($revision->updated_at->toISOString() !== $expectedUpdatedAt) {
            throw ValidationException::withMessages(['version' => ['Revision changed; reload or clone before saving.']]);
        }
        $blueprint = $revision->blueprint;
        foreach ($operations as $operation) {
            $path = (string) ($operation['path'] ?? '');
            $value = $operation['value'] ?? null;
            if (! preg_match(self::EDITABLE, $path)) {
                throw ValidationException::withMessages(['path' => ["Field path [$path] is not editable."]]);
            }
            $this->assertSafe($path, $value);
            $old = Arr::get($blueprint, $path);
            if ($old === $value) {
                continue;
            }
            Arr::set($blueprint, $path, $value);
            RevisionChange::create(['organization_id' => $revision->organization_id, 'website_revision_id' => $revision->id, 'field_path' => $path, 'change_type' => 'replace', 'old_value' => $old, 'new_value' => $value, 'actor_type' => 'user', 'actor_id' => auth()->id(), 'created_at' => now()]);
        }
        $revision->update(['blueprint' => $blueprint, 'validation' => null, 'elementor_output' => null, 'change_summary' => $this->summary($revision)]);

        return $revision->fresh('changes');
    }

    public function validate(WebsiteRevision $revision): array
    {
        $errors = [];
        $ids = [];
        $slugs = [];
        $supported = ['hero', 'text', 'custom', 'services', 'features', 'testimonials', 'cta', 'contact', 'faq', 'image-text', 'business-hours', 'logo-strip', 'statistics', 'header', 'footer'];
        foreach (($revision->blueprint['pages'] ?? []) as $pi => $page) {
            if (empty($page['title'])) {
                $errors[] = ['path' => "pages.$pi.title", 'message' => 'Page title is required.'];
            }
            if (isset($slugs[$page['slug'] ?? ''])) {
                $errors[] = ['path' => "pages.$pi.slug", 'message' => 'Page slug must be unique.'];
            } $slugs[$page['slug'] ?? ''] = true;
            foreach ([$page, ...($page['sections'] ?? [])] as $item) {
                $id = $item['id'] ?? null;
                if (! $id || isset($ids[$id])) {
                    $errors[] = ['path' => "pages.$pi", 'message' => 'Stable IDs must be present and unique.'];
                } if ($id) {
                    $ids[$id] = true;
                }
            }
            foreach (($page['sections'] ?? []) as $si => $section) {
                if (! in_array($section['type'] ?? '', $supported, true)) {
                    $errors[] = ['path' => "pages.$pi.sections.$si.type", 'message' => 'Unsupported component type.'];
                }
            }
        }
        try {
            $this->assertSafe('blueprint', $revision->blueprint);
        } catch (ValidationException $e) {
            $errors[] = ['path' => 'blueprint', 'message' => $e->getMessage()];
        }
        $result = ['valid' => $errors === [], 'errors' => $errors, 'validated_at' => now()->toISOString()];
        $revision->update(['validation' => $result, 'status' => $errors === [] ? $revision->status : 'invalid']);

        return $result;
    }

    public function approve(WebsiteRevision $revision): WebsiteRevision
    {
        return DB::transaction(function () use ($revision) {
            $revision = WebsiteRevision::lockForUpdate()->findOrFail($revision->id);
            if ($revision->status !== 'ready' || ! ($revision->validation['valid'] ?? false) || ! $revision->elementor_output) {
                throw ValidationException::withMessages(['revision' => ['A validated, rendered ready revision is required.']]);
            }
            WebsiteRevision::where('project_id', $revision->project_id)->where('status', 'approved')->whereKeyNot($revision->id)->update(['status' => 'superseded']);
            $revision->update(['status' => 'approved', 'approved_by' => auth()->id(), 'approved_at' => now()]);
            $revision->project()->update(['approved_revision_id' => $revision->id]);
            $this->audit('revision.approved', $revision, ['revision_number' => $revision->revision_number]);

            return $revision;
        });
    }

    public function normalize(array $blueprint): array
    {
        foreach (($blueprint['pages'] ?? []) as &$page) {
            $page['id'] ??= 'page_'.Str::lower(Str::random(12));
            foreach (($page['sections'] ?? []) as &$section) {
                $section['id'] ??= 'section_'.Str::lower(Str::random(12));
                foreach (($section['components'] ?? []) as &$block) {
                    $block['id'] ??= 'block_'.Str::lower(Str::random(12));
                    $block['fieldId'] ??= 'field_'.Str::lower(Str::random(12));
                } unset($block);
            } unset($section);
        } unset($page);

        return $blueprint;
    }

    public function summary(WebsiteRevision $revision): array
    {
        return ['changes' => $revision->changes()->count(), 'fields' => $revision->changes()->distinct()->pluck('field_path')->values()->all()];
    }

    private function assertSafe(string $path, mixed $value): void
    {
        if ($path === 'branding.typography.bodyFont' || $path === 'branding.typography.headingFont') {
            if (! in_array($value, self::FONTS, true)) {
                throw ValidationException::withMessages([$path => ['Font is not allowed.']]);
            }
        } $encoded = json_encode($value);
        if (preg_match('/<\s*script|javascript:|data:text\/html|on[a-z]+\s*=|<\?php|\[[a-z_]+\]/i', (string) $encoded)) {
            throw ValidationException::withMessages([$path => ['Scripts, unsafe HTML, event handlers, shortcodes, and unsafe protocols are not allowed.']]);
        }
    }

    private function audit(string $action, WebsiteRevision $revision, array $metadata = []): void
    {
        if (request()) {
            app(AuditService::class)->record(request(), $action, 'website_revision', $revision->id, $metadata, $revision->organization_id);
        }
    }
}
