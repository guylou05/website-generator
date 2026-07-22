'use client';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { dashboardApi } from '@/lib/api-client';
export default function Register() {
  const router = useRouter(),
    [error, setError] = useState('');
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      await dashboardApi.register({
        name: String(f.get('name')),
        email: String(f.get('email')),
        password: String(f.get('password')),
        password_confirmation: String(f.get('password')),
      });
      router.replace('/dashboard');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Registration failed.');
    }
  }
  return (
    <main className="grid min-h-screen place-items-center">
      <form onSubmit={submit} className="card w-full max-w-md space-y-4 p-8">
        <h1 className="text-2xl font-semibold">Create your account</h1>
        <input required name="name" className="field" placeholder="Name" />
        <input
          required
          name="email"
          type="email"
          className="field"
          placeholder="Email"
        />
        <input
          required
          minLength={8}
          name="password"
          type="password"
          className="field"
          placeholder="Password"
        />
        {error && <p className="text-red-600">{error}</p>}
        <button className="bg-primary text-primary-foreground w-full rounded-lg py-2.5">
          Register
        </button>
        <Link className="block text-center text-sm" href="/login">
          Already registered?
        </Link>
      </form>
    </main>
  );
}
