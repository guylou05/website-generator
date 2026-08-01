'use client';
import { FormEvent, useState } from 'react';
import { authProvider } from '@/lib/auth-provider';
import { DashboardApiError } from '@/lib/api-client';
export default function Forgot() {
  const [message, setMessage] = useState(''),
    [error, setError] = useState('');
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setError('');
    try {
      await authProvider.forgotPassword(String(f.get('email')));
      setMessage('If an account exists, a reset link has been sent.');
    } catch (e) {
      setError(
        e instanceof DashboardApiError && e.status === 429
          ? 'Too many reset requests. Please wait and try again.'
          : e instanceof Error
            ? e.message
            : 'Unable to request a password reset.',
      );
    }
  }
  return (
    <main className="grid min-h-screen place-items-center">
      <form onSubmit={submit} className="card w-full max-w-md space-y-4 p-8">
        <h1 className="text-2xl font-semibold">Reset password</h1>
        <input
          required
          name="email"
          type="email"
          className="field"
          placeholder="Email"
        />
        <button className="bg-primary text-primary-foreground w-full rounded-lg py-2.5">
          Send reset link
        </button>
        {message && <p>{message}</p>}
        {error && (
          <p role="alert" className="text-red-600">
            {error}
          </p>
        )}
      </form>
    </main>
  );
}
