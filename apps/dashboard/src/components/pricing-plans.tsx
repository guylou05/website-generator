'use client';
import type { BillingPlan } from '@/lib/api-client';
export function PricingPlans({
  plans,
  current,
  interval,
  onSelect,
}: {
  plans: BillingPlan[];
  current: string;
  interval: 'monthly' | 'yearly';
  onSelect: (p: BillingPlan) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      {plans.map((plan) => (
        <article
          key={plan.key}
          className={`rounded-2xl border p-5 ${plan.key === current ? 'border-violet-500 bg-violet-50' : 'border-slate-200'}`}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">{plan.name}</h3>
            {plan.recommended && (
              <span className="rounded-full bg-violet-100 px-2 py-1 text-xs text-violet-700">
                Recommended
              </span>
            )}
          </div>
          <p className="mt-3 text-sm text-slate-600">
            {plan.entitlements.projects} projects · {plan.entitlements.members}{' '}
            members
          </p>
          <p className="text-sm text-slate-600">
            {plan.entitlements.generations} generations ·{' '}
            {plan.entitlements.live_deployments} live deploys / month
          </p>
          <button
            disabled={
              plan.key === current ||
              plan.key === 'free' ||
              !plan.available[interval]
            }
            onClick={() => onSelect(plan)}
            className="mt-5 w-full rounded-lg bg-slate-900 px-3 py-2 text-sm text-white disabled:bg-slate-300"
          >
            {plan.key === current ? 'Current plan' : 'Choose plan'}
          </button>
        </article>
      ))}
    </div>
  );
}
