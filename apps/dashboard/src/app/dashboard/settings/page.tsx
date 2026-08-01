'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Bell,
  Building2,
  CreditCard,
  KeyRound,
  Palette,
  UserRound,
} from 'lucide-react';
import { PageHeading } from '@/components/page-heading';
import {
  dashboardApi,
  DashboardApiError,
  type OrganizationSettings,
  type Profile,
} from '@/lib/api-client';

type Tab =
  | 'Profile'
  | 'Organization'
  | 'Notifications'
  | 'Billing'
  | 'Security'
  | 'Appearance';
const tabs: Array<{ label: Tab; Icon: typeof UserRound }> = [
  { label: 'Profile', Icon: UserRound },
  { label: 'Organization', Icon: Building2 },
  { label: 'Notifications', Icon: Bell },
  { label: 'Billing', Icon: CreditCard },
  { label: 'Security', Icon: KeyRound },
  { label: 'Appearance', Icon: Palette },
];
const notificationLabels: Record<string, string> = {
  generation_completed: 'Generation completed',
  generation_failed: 'Generation failed',
  deployment_completed: 'Deployment completed',
  deployment_failed: 'Deployment failed',
  billing_notices: 'Billing notices',
  security_notices: 'Security notices',
};

export default function Settings() {
  const requestedTab = useSearchParams().get('tab');
  const initialTab = tabs.some(({ label }) => label === requestedTab)
    ? (requestedTab as Tab)
    : 'Profile';
  const [tab, setTab] = useState<Tab>(initialTab);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [organization, setOrganization] = useState<OrganizationSettings | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string[]>>({});
  useEffect(() => setTab(initialTab), [initialTab]);
  useEffect(() => {
    Promise.all([dashboardApi.profile(), dashboardApi.organizationSettings()])
      .then(([p, o]) => {
        setProfile(p);
        setOrganization(o);
      })
      .catch((reason) =>
        setError(
          reason instanceof DashboardApiError && reason.status === 401
            ? 'Your session has expired. Sign in again.'
            : reason instanceof Error
              ? reason.message
              : 'Settings could not be loaded.',
        ),
      )
      .finally(() => setLoading(false));
  }, []);
  const run = async (action: () => Promise<void>) => {
    setSaving(true);
    setError('');
    setFields({});
    setMessage('');
    try {
      await action();
      setMessage('Changes saved.');
    } catch (reason) {
      if (reason instanceof DashboardApiError) setFields(reason.details ?? {});
      setError(
        reason instanceof Error
          ? reason.message
          : 'Changes could not be saved.',
      );
    } finally {
      setSaving(false);
    }
  };
  const saveProfile = (event: FormEvent) => {
    event.preventDefault();
    if (!profile) return;
    void run(async () =>
      setProfile(
        await dashboardApi.updateProfile({
          first_name: profile.first_name,
          last_name: profile.last_name,
          email: profile.email,
          timezone: profile.timezone,
          locale: profile.locale,
        }),
      ),
    );
  };
  const applyTheme = (appearance: Profile['appearance']) => {
    if (!profile) return;
    const dark =
      appearance === 'dark' ||
      (appearance === 'system' &&
        matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', appearance);
    setProfile({ ...profile, appearance });
    void run(async () =>
      setProfile(await dashboardApi.updateProfile({ appearance })),
    );
  };
  if (loading)
    return <div className="bg-muted h-80 animate-pulse rounded-xl" />;
  if (!profile || !organization)
    return (
      <section className="card p-8 text-center">
        <h1 className="font-semibold">Settings unavailable</h1>
        <p className="text-muted-foreground mt-2 text-sm">{error}</p>
        <button
          onClick={() => location.reload()}
          className="mt-4 rounded-lg border px-4 py-2 text-sm"
        >
          Retry
        </button>
      </section>
    );
  return (
    <>
      <PageHeading
        title="Settings"
        description="Manage your account, organization, preferences, and security."
      />
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav className="space-y-1">
          {tabs.map(({ label, Icon }) => (
            <button
              key={label}
              onClick={() => {
                setTab(label);
                setError('');
                setMessage('');
              }}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${tab === label ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'}`}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </nav>
        <div className="space-y-4">
          {error && (
            <p
              role="alert"
              className="rounded-lg bg-red-500/10 p-3 text-sm text-red-700"
            >
              {error}
            </p>
          )}
          {message && (
            <p
              role="status"
              className="rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-700"
            >
              {message}
            </p>
          )}
          {tab === 'Profile' && (
            <form className="card p-6" onSubmit={saveProfile}>
              <h2 className="font-semibold">Profile information</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Your personal account details.
              </p>
              <div className="mt-6 flex items-center gap-4">
                <span className="bg-primary text-primary-foreground grid size-16 place-items-center overflow-hidden rounded-full text-lg font-semibold">
                  {profile.avatar?.url ? (
                    <img
                      alt="Profile avatar"
                      className="size-full object-cover"
                      src={profile.avatar.url}
                    />
                  ) : (
                    `${profile.first_name?.[0] ?? profile.name[0] ?? ''}${profile.last_name?.[0] ?? ''}`
                  )}
                </span>
                <p className="text-muted-foreground text-xs">
                  Choose an uploaded image from Media for avatars. Direct upload
                  is not yet supported.
                </p>
              </div>
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <Field
                  label="First name"
                  value={profile.first_name ?? ''}
                  error={fields.first_name?.[0]}
                  onChange={(first_name) =>
                    setProfile({ ...profile, first_name })
                  }
                />
                <Field
                  label="Last name"
                  value={profile.last_name ?? ''}
                  error={fields.last_name?.[0]}
                  onChange={(last_name) =>
                    setProfile({ ...profile, last_name })
                  }
                />
                <Field
                  label="Email address"
                  type="email"
                  value={profile.email}
                  error={fields.email?.[0]}
                  onChange={(email) => setProfile({ ...profile, email })}
                />
                <Field
                  label="Timezone"
                  value={profile.timezone ?? ''}
                  error={fields.timezone?.[0]}
                  onChange={(timezone) => setProfile({ ...profile, timezone })}
                />
              </div>
              <p className="text-muted-foreground mt-3 text-xs">
                Changing email also requires your current password and
                re-verification.
              </p>
              <Save saving={saving} />
            </form>
          )}
          {tab === 'Organization' && (
            <form
              className="card p-6"
              onSubmit={(event) => {
                event.preventDefault();
                void run(async () =>
                  setOrganization(
                    await dashboardApi.updateOrganizationSettings(organization),
                  ),
                );
              }}
            >
              <h2 className="font-semibold">Organization</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Plan: {organization.plan} · Role: {organization.role}
              </p>
              <fieldset
                disabled={!organization.can_edit}
                className="mt-6 grid gap-5 disabled:opacity-60 sm:grid-cols-2"
              >
                <Field
                  label="Organization name"
                  value={organization.name}
                  error={fields.name?.[0]}
                  onChange={(name) =>
                    setOrganization({ ...organization, name })
                  }
                />
                <Field
                  label="Billing email"
                  type="email"
                  value={organization.billing_email ?? ''}
                  onChange={(billing_email) =>
                    setOrganization({ ...organization, billing_email })
                  }
                />
                <Field
                  label="Company website"
                  type="url"
                  value={organization.company_website ?? ''}
                  onChange={(company_website) =>
                    setOrganization({ ...organization, company_website })
                  }
                />
                <Field
                  label="Industry"
                  value={organization.industry ?? ''}
                  onChange={(industry) =>
                    setOrganization({ ...organization, industry })
                  }
                />
              </fieldset>
              {organization.can_manage_members && (
                <Link
                  className="text-primary mt-4 inline-block text-sm"
                  href={`/dashboard/organizations/${organization.id}/members`}
                >
                  Manage members
                </Link>
              )}
              {organization.can_edit ? (
                <Save saving={saving} />
              ) : (
                <p className="mt-5 text-sm">You have view-only access.</p>
              )}
            </form>
          )}
          {tab === 'Notifications' && (
            <section className="card p-6">
              <h2 className="font-semibold">Notifications</h2>
              <div className="mt-5 space-y-3">
                {Object.entries(notificationLabels).map(([key, label]) => (
                  <label
                    key={key}
                    className="flex items-center justify-between rounded-lg border p-3 text-sm"
                  >
                    <span>
                      {label}
                      {key === 'security_notices' && (
                        <span className="text-muted-foreground block text-xs">
                          Required for account security
                        </span>
                      )}
                    </span>
                    <input
                      type="checkbox"
                      disabled={key === 'security_notices'}
                      checked={profile.notification_preferences[key] ?? true}
                      onChange={(event) =>
                        setProfile({
                          ...profile,
                          notification_preferences: {
                            ...profile.notification_preferences,
                            [key]: event.target.checked,
                          },
                        })
                      }
                    />
                  </label>
                ))}
              </div>
              <button
                disabled={saving}
                onClick={() =>
                  void run(async () =>
                    setProfile(
                      await dashboardApi.updateProfile({
                        notification_preferences:
                          profile.notification_preferences,
                      }),
                    ),
                  )
                }
                className="bg-primary text-primary-foreground mt-6 rounded-lg px-4 py-2.5 text-sm"
              >
                Save notifications
              </button>
            </section>
          )}
          {tab === 'Billing' && (
            <section className="card p-6">
              <h2 className="font-semibold">Billing</h2>
              <p className="text-muted-foreground mt-2 text-sm">
                Current plan: <strong>{organization.plan}</strong>
              </p>
              {organization.can_manage_billing ? (
                <Link
                  href="/dashboard/settings/billing"
                  className="text-primary mt-4 inline-block text-sm font-medium"
                >
                  Manage billing and usage
                </Link>
              ) : (
                <p className="mt-4 text-sm">
                  Only owners and admins can manage billing.
                </p>
              )}
            </section>
          )}
          {tab === 'Security' && (
            <Security
              saving={saving}
              run={run}
              verified={Boolean(profile.email_verified_at)}
              lastLogin={profile.last_login_at}
            />
          )}
          {tab === 'Appearance' && (
            <section className="card p-6">
              <h2 className="font-semibold">Appearance</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Applied immediately and saved to your profile.
              </p>
              <div className="mt-5 grid grid-cols-3 gap-3">
                {(['light', 'dark', 'system'] as const).map((mode) => (
                  <button
                    key={mode}
                    disabled={saving}
                    onClick={() => applyTheme(mode)}
                    className={`rounded-lg border p-3 text-sm font-medium capitalize ${profile.appearance === mode ? 'border-primary bg-primary/5 text-primary' : ''}`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  error?: string | undefined;
}) {
  return (
    <label className="text-sm font-medium">
      {label}
      <input
        className="field mt-2"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {error && (
        <span className="mt-1 block text-xs text-red-600">{error}</span>
      )}
    </label>
  );
}
function Save({ saving }: { saving: boolean }) {
  return (
    <div className="mt-6 flex justify-end">
      <button
        disabled={saving}
        className="bg-primary text-primary-foreground rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-60"
      >
        {saving ? 'Saving…' : 'Save changes'}
      </button>
    </div>
  );
}
function Security({
  saving,
  run,
  verified,
  lastLogin,
}: {
  saving: boolean;
  run: (action: () => Promise<void>) => Promise<void>;
  verified: boolean;
  lastLogin: string | null;
}) {
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  return (
    <section className="card p-6">
      <h2 className="font-semibold">Security</h2>
      <p className="text-muted-foreground mt-2 text-sm">
        Email {verified ? 'verified' : 'not verified'} · Last login:{' '}
        {lastLogin ? new Date(lastLogin).toLocaleString() : 'No data yet'}
      </p>
      {!verified && (
        <button
          className="text-primary mt-2 text-sm"
          onClick={() =>
            void run(async () => {
              await dashboardApi.resendVerification();
            })
          }
        >
          Resend verification
        </button>
      )}
      <div className="mt-6 grid gap-4">
        <Field
          label="Current password"
          type="password"
          value={current}
          onChange={setCurrent}
        />
        <Field
          label="New password"
          type="password"
          value={password}
          onChange={setPassword}
        />
        <Field
          label="Confirm new password"
          type="password"
          value={confirmation}
          onChange={setConfirmation}
        />
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          disabled={saving}
          onClick={() =>
            void run(async () => {
              await dashboardApi.changePassword({
                current_password: current,
                password,
                password_confirmation: confirmation,
              });
              setCurrent('');
              setPassword('');
              setConfirmation('');
            })
          }
          className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm"
        >
          Change password
        </button>
        <button
          disabled={saving}
          onClick={() =>
            void run(async () => {
              await dashboardApi.revokeOtherSessions();
            })
          }
          className="rounded-lg border px-4 py-2 text-sm"
        >
          Revoke other sessions
        </button>
      </div>
    </section>
  );
}
