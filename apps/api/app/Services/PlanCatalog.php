<?php

namespace App\Services;

use Illuminate\Validation\ValidationException;

class PlanCatalog
{
    public function all(): array
    {
        return config('billing.plans');
    }

    public function plan(string $key): array
    {
        return $this->all()[$key] ?? throw ValidationException::withMessages(['plan_key' => ['Unknown billing plan.']]);
    }

    public function price(string $key, string $interval): string
    {
        $price = $this->plan($key)['prices'][$interval] ?? null;
        if (! $price || $key === 'free') {
            throw ValidationException::withMessages(['plan_key' => ['This plan and interval is unavailable.']]);
        }

return $price;
    }

    public function keyForPrice(string $price): ?array
    {
        foreach ($this->all() as $key => $plan) {
            foreach ($plan['prices'] as $interval => $id) {
                if ($id && hash_equals($id, $price)) {
                    return [$key, $interval];
                }
            }
        }

return null;
    }

    public function publicPlans(): array
    {
        return collect($this->all())->map(fn ($p, $key) => ['key' => $key, 'name' => $p['name'], 'recommended' => $p['recommended'] ?? false, 'available' => ['monthly' => (bool) $p['prices']['monthly'], 'yearly' => (bool) $p['prices']['yearly']], 'entitlements' => $p['entitlements']])->values()->all();
    }
}
