'use client';
import { FormEvent, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { dashboardApi } from '@/lib/api-client';
export default function Reset() {
  const q = useSearchParams(),
    router = useRouter(),
    [error, setError] = useState('');
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      await dashboardApi.resetPassword({
        email: q.get('email') ?? '',
        token: q.get('token') ?? '',
        password: String(f.get('password')),
        password_confirmation: String(f.get('confirmation')),
      });
      router.replace('/login');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reset failed.');
    }
  }
  return (
    <main className="grid min-h-screen place-items-center">
      <form onSubmit={submit} className="card w-full max-w-md space-y-4 p-8">
        <h1 className="text-2xl font-semibold">Choose a new password</h1>
        <input required name="password" type="password" className="field" />
        <input required name="confirmation" type="password" className="field" />
        {error && <p>{error}</p>}
        <button className="bg-primary text-primary-foreground w-full rounded-lg py-2.5">
          Reset password
        </button>
      </form>
    </main>
  );
}
