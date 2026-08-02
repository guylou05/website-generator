'use client';

import { useState } from 'react';
import { dashboardApi, type DeploymentPlan } from '@/lib/api-client';

const warningId = async (warning: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(warning)),
    ),
  )
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

export function DeploymentApprovalPanel({
  plan,
  onChange,
}: {
  plan: DeploymentPlan;
  onChange: (plan: DeploymentPlan) => void;
}) {
  const [acknowledged, setAcknowledged] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const approved = plan.status === 'approved';
  const blocked = plan.safetyStatus === 'blocked';
  const approve = async () => {
    setBusy(true);
    setError('');
    try {
      const ids = await Promise.all(acknowledged.map(warningId));
      onChange(await dashboardApi.approveDeploymentPlan(plan.id, ids, comment));
      setConfirming(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Approval failed.');
    } finally {
      setBusy(false);
    }
  };
  const reject = async () => {
    if (!reason.trim()) return setError('A rejection reason is required.');
    setBusy(true);
    try {
      onChange(await dashboardApi.rejectDeploymentPlan(plan.id, reason));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rejection failed.');
    } finally {
      setBusy(false);
    }
  };
  const count = (resource: string, action?: string) =>
    plan.changes.filter(
      (x) => x.resource === resource && (!action || x.action === action),
    ).length;
  return (
    <section className="card p-5 sm:p-6" aria-labelledby="approval-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-sky-700">
            Deployment approval
          </p>
          <h2 id="approval-title" className="mt-1 text-xl font-semibold">
            Safety and authorization
          </h2>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm font-semibold ${approved ? 'bg-emerald-100 text-emerald-800' : blocked ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}
        >
          {approved ? '✓ Approved' : blocked ? 'Blocked' : 'Awaiting approval'}
        </span>
      </div>
      <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <Info
          label="Source revision"
          value={plan.websiteRevisionId ?? 'Saved revision'}
        />
        <Info
          label="Target WordPress"
          value={plan.wordpressConnectionId ?? 'Verified connection'}
        />
        <Info
          label="Snapshot"
          value={
            plan.snapshotCapturedAt
              ? new Date(plan.snapshotCapturedAt).toLocaleString()
              : 'Captured during dry run'
          }
        />
        <Info
          label="Expires"
          value={
            plan.expiresAt
              ? new Date(plan.expiresAt).toLocaleString()
              : 'Not available'
          }
        />
        <Info
          label="Creates / updates"
          value={`${plan.statistics.create ?? 0} / ${plan.statistics.update ?? 0}`}
        />
        <Info label="Pages" value={String(count('page'))} />
        <Info label="Approver required" value="Organization owner or admin" />
        <Info
          label="Options"
          value={
            Object.keys(plan.options ?? {}).length
              ? JSON.stringify(plan.options)
              : 'Dry-run defaults'
          }
        />
      </div>
      {approved ? (
        <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm">
          <p className="font-semibold text-emerald-900">
            Immutable deployment artifact
          </p>
          <p className="mt-1 text-emerald-800">
            Approved{' '}
            {plan.approvedAt ? new Date(plan.approvedAt).toLocaleString() : ''}
            {plan.approvedBy ? ` by ${plan.approvedBy}` : ''}. This exact change
            set will be used for deployment.
          </p>
          {plan.approvalComment && (
            <p className="mt-2 italic">“{plan.approvalComment}”</p>
          )}
          <button
            disabled
            className="mt-4 rounded-lg bg-slate-300 px-4 py-2 font-semibold text-slate-600"
            title="Deployment execution will be available in Phase 5.4."
          >
            Deploy (Phase 5.4)
          </button>
        </div>
      ) : plan.status === 'rejected' ? (
        <div className="mt-5 rounded-lg bg-red-50 p-4 text-red-900">
          <strong>Rejected:</strong> {plan.rejectionReason}
        </div>
      ) : (
        <>
          {plan.warnings.length > 0 && (
            <fieldset className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <legend className="px-1 font-semibold text-amber-950">
                Acknowledge every warning
              </legend>
              {plan.warnings.map((warning) => (
                <label
                  className="mt-2 flex gap-2 text-sm text-amber-950"
                  key={warning}
                >
                  <input
                    type="checkbox"
                    checked={acknowledged.includes(warning)}
                    onChange={(e) =>
                      setAcknowledged(
                        e.target.checked
                          ? [...acknowledged, warning]
                          : acknowledged.filter((x) => x !== warning),
                      )
                    }
                  />
                  {warning}
                </label>
              ))}
            </fieldset>
          )}
          <label className="mt-5 block text-sm font-medium">
            Optional approval comment
            <textarea
              className="mt-1 block min-h-20 w-full rounded-lg border p-3 font-normal"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </label>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              className="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white disabled:opacity-40"
              disabled={
                blocked || busy || acknowledged.length !== plan.warnings.length
              }
              onClick={() => setConfirming(true)}
            >
              Approve Deployment Plan
            </button>
            <input
              aria-label="Rejection reason"
              className="min-w-64 flex-1 rounded-lg border px-3"
              placeholder="Required rejection reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <button
              className="rounded-lg border border-red-300 px-4 py-2 font-semibold text-red-700"
              disabled={busy}
              onClick={reject}
            >
              Reject Plan
            </button>
          </div>
        </>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {confirming && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-w-xl rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-xl font-semibold">Approve this exact plan?</h3>
            <p className="mt-3 text-sm text-slate-600">
              You are approving this exact deployment plan. Any later change to
              the generated revision, selected WordPress site, deployment
              options, or WordPress snapshot will require a new dry run.
            </p>
            <ul className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <li>Pages create: {count('page', 'create')}</li>
              <li>Pages update: {count('page', 'update')}</li>
              <li>Media uploads: {count('media', 'create')}</li>
              <li>Menu changes: {count('menu')}</li>
              <li>Homepage changes: {count('homepage')}</li>
              <li>SEO changes: {count('seo')}</li>
              <li>Risk: {plan.safetyStatus}</li>
            </ul>
            <div className="mt-6 flex justify-end gap-3">
              <button
                className="rounded-lg border px-4 py-2"
                onClick={() => setConfirming(false)}
              >
                Cancel
              </button>
              <button
                className="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white"
                disabled={busy}
                onClick={approve}
              >
                Confirm approval
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 break-all font-medium">{value}</p>
    </div>
  );
}
