'use client';
import { FormEvent, useState } from 'react';
import { dashboardApi } from '@/lib/api-client';
export default function Forgot() {
  const [message, setMessage] = useState('');
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await dashboardApi.forgotPassword(String(f.get('email')));
    setMessage('If an account exists, a reset link has been sent.');
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
      </form>
    </main>
  );
}
