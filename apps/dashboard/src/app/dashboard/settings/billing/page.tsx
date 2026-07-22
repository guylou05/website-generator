'use client';
import { useEffect, useState } from 'react';
import {
  dashboardApi,
  type BillingPlan,
  type BillingSummary,
  type BillingUsage,
  DashboardApiError,
} from '@/lib/api-client';
import { PricingPlans } from '@/components/pricing-plans';
export default function BillingPage() {
  const [plans, setPlans] = useState<BillingPlan[]>([]),
    [summary, setSummary] = useState<BillingSummary | null>(null),
    [usage, setUsage] = useState<BillingUsage | null>(null),
    [interval, setInterval] = useState<'monthly' | 'yearly'>('monthly'),
    [error, setError] = useState('');
  useEffect(() => {
    Promise.all([
      dashboardApi.getPlans(),
      dashboardApi.getBillingSummary(),
      dashboardApi.getUsage(),
    ])
      .then(([p, s, u]) => {
        setPlans(p);
        setSummary(s);
        setUsage(u);
        setInterval(
          (s.subscription?.billing_interval as 'monthly' | 'yearly') ??
            'monthly',
        );
      })
      .catch((e) =>
        setError(
          e instanceof DashboardApiError
            ? e.message
            : 'Billing could not be loaded.',
        ),
      );
  }, []);
  async function checkout(p: BillingPlan) {
    const base = window.location.origin + '/dashboard/settings/billing';
    const r = await dashboardApi.createCheckoutSession({
      plan_key: p.key,
      billing_interval: interval,
      success_url: base + '?checkout=pending',
      cancel_url: base + '?checkout=cancelled',
    });
    window.location.assign(r.url);
  }
  async function portal() {
    const r = await dashboardApi.createPortalSession(
      new URL(window.location.href).origin +
        new URL(window.location.href).pathname,
    );
    window.location.assign(r.url);
  }
  return (
    <main className="space-y-8">
      <div>
        <p className="text-sm font-medium text-violet-600">
          Organization billing
        </p>
        <h1 className="text-3xl font-bold">Plans and usage</h1>
        <p className="mt-2 text-slate-600">
          Stripe webhooks—not checkout redirects—determine subscription access.
        </p>
      </div>
      {error && (
        <div className="rounded-xl bg-red-50 p-4 text-red-700">{error}</div>
      )}
      {summary?.subscription?.status === 'past_due' && (
        <div className="rounded-xl bg-amber-50 p-4 text-amber-800">
          Payment failed. Plan access continues only through the grace period.
        </div>
      )}
      <div className="flex gap-2">
        <button
          onClick={() => setInterval('monthly')}
          className="rounded-lg border px-4 py-2"
        >
          Monthly
        </button>
        <button
          onClick={() => setInterval('yearly')}
          className="rounded-lg border px-4 py-2"
        >
          Yearly
        </button>
        {summary?.subscription && (
          <button
            onClick={portal}
            className="ml-auto rounded-lg bg-violet-600 px-4 py-2 text-white"
          >
            Manage billing & invoices
          </button>
        )}
      </div>
      {summary && (
        <PricingPlans
          plans={plans}
          current={summary.current_plan}
          interval={interval}
          onSelect={checkout}
        />
      )}
      <section className="grid gap-4 md:grid-cols-2">
        {usage &&
          Object.entries(usage.metrics).map(([metric, value]) => (
            <div key={metric} className="rounded-xl border p-5">
              <div className="flex justify-between">
                <strong>{metric.replaceAll('_', ' ')}</strong>
                <span>
                  {value.used} / {value.limit}
                </span>
              </div>
              <div className="mt-3 h-2 rounded bg-slate-100">
                <div
                  className="h-2 rounded bg-violet-500"
                  style={{
                    width: `${Math.min(100, value.limit ? (value.used / value.limit) * 100 : 100)}%`,
                  }}
                />
              </div>
            </div>
          ))}
      </section>
    </main>
  );
}
