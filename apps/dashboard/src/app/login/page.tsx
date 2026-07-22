'use client';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Logo } from '@/components/logo';
import { dashboardApi, DashboardApiError } from '@/lib/api-client';
export default function Login() {
  const router = useRouter(),
    params = useSearchParams();
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const f = new FormData(e.currentTarget);
    try {
      await dashboardApi.login({
        email: String(f.get('email')),
        password: String(f.get('password')),
        remember: f.get('remember') === 'on',
      });
      const intended = params.get('next');
      router.replace(
        intended?.startsWith('/') && !intended.startsWith('//')
          ? intended
          : '/dashboard',
      );
    } catch (e) {
      setError(
        e instanceof DashboardApiError ? e.message : 'Unable to sign in.',
      );
      setBusy(false);
    }
  }
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <section className="w-full max-w-sm">
        <Logo />
        <h1 className="mt-10 text-3xl font-semibold">Welcome back</h1>
        <p className="text-muted-foreground mt-2">
          Sign in to your organization.
        </p>
        <form onSubmit={submit} className="mt-8 space-y-4">
          <label className="block text-sm font-medium">
            Email
            <input
              required
              name="email"
              type="email"
              className="field mt-2"
              autoComplete="email"
            />
          </label>
          <label className="block text-sm font-medium">
            Password
            <input
              required
              name="password"
              type="password"
              className="field mt-2"
              autoComplete="current-password"
            />
          </label>
          <label className="flex gap-2 text-sm">
            <input name="remember" type="checkbox" />
            Remember me
          </label>
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
          <button
            disabled={busy}
            className="bg-primary text-primary-foreground w-full rounded-lg py-2.5"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <div className="mt-5 flex justify-between text-sm">
          <Link href="/forgot-password">Forgot password?</Link>
          <Link href="/register">Create account</Link>
        </div>
      </section>
    </main>
  );
}
