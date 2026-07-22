<?php

namespace App\Models\Concerns;

use Illuminate\Database\Eloquent\Builder;

trait TenantBound
{
    protected static function bootTenantBound(): void
    {
        static::creating(function ($model) {
            if (! $model->organization_id && auth()->user()?->current_organization_id) {
                $model->organization_id = auth()->user()->current_organization_id;
            }
        });
    }

    public function resolveRouteBindingQuery($query, $value, $field = null): Builder
    {
        $query = parent::resolveRouteBindingQuery($query, $value, $field);
        $user = request()->user();

        return $user && $user->current_organization_id ? $query->where($this->qualifyColumn('organization_id'), $user->current_organization_id) : $query;
    }
}
