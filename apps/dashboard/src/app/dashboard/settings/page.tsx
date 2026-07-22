'use client';
import { Bell, CreditCard, KeyRound, UserRound } from 'lucide-react';
import { PageHeading } from '@/components/page-heading';
export default function Settings() {
  return (
    <>
      <PageHeading
        title="Settings"
        description="Manage your account, preferences, and billing."
      />
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav className="space-y-1">
          {[
            { label: 'Profile', Icon: UserRound },
            { label: 'Notifications', Icon: Bell },
            { label: 'Billing', Icon: CreditCard },
            { label: 'Security', Icon: KeyRound },
          ].map(({ label, Icon }, i) => (
            <button
              key={label}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${i === 0 ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'}`}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </nav>
        <div className="space-y-6">
          <section className="card p-6">
            <h2 className="font-semibold">Profile information</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Update your photo and personal details.
            </p>
            <div className="mt-6 flex items-center gap-4">
              <span className="grid size-16 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-lg font-semibold text-white">
                AM
              </span>
              <div>
                <button className="rounded-lg border px-3 py-2 text-sm font-medium">
                  Change photo
                </button>
                <p className="text-muted-foreground mt-2 text-xs">
                  JPG or PNG. 2MB maximum.
                </p>
              </div>
            </div>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <label className="text-sm font-medium">
                First name
                <input className="field mt-2" defaultValue="Alex" />
              </label>
              <label className="text-sm font-medium">
                Last name
                <input className="field mt-2" defaultValue="Morgan" />
              </label>
              <label className="text-sm font-medium sm:col-span-2">
                Email address
                <input
                  className="field mt-2"
                  type="email"
                  defaultValue="alex@example.com"
                />
              </label>
              <label className="text-sm font-medium sm:col-span-2">
                Company
                <input className="field mt-2" defaultValue="Northstar Studio" />
              </label>
            </div>
            <div className="mt-6 flex justify-end">
              <button className="bg-primary text-primary-foreground rounded-lg px-4 py-2.5 text-sm font-medium">
                Save changes
              </button>
            </div>
          </section>
          <section className="card p-6">
            <h2 className="font-semibold">Appearance</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Choose how SiteFoundry looks on your device.
            </p>
            <div className="mt-5 grid grid-cols-3 gap-3">
              {['Light', 'Dark', 'System'].map((x, i) => (
                <button
                  key={x}
                  className={`rounded-lg border p-3 text-sm font-medium ${i === 2 ? 'border-primary bg-primary/5 text-primary' : ''}`}
                >
                  {x}
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
