'use client';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authProvider } from '@/lib/auth-provider';
import { DashboardApiError } from '@/lib/api-client';
export default function Register() {
  const router = useRouter(),
    [error, setError] = useState(''),
    [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setError('');
    setFieldErrors({});
    try {
      await authProvider.register({
        name: String(f.get('name')),
        email: String(f.get('email')),
        password: String(f.get('password')),
        password_confirmation: String(f.get('password')),
      });
      router.replace('/dashboard');
    } catch (e) {
      if (e instanceof DashboardApiError) {
        setFieldErrors(e.details ?? {});
        setError(
          e.status === 429
            ? 'Too many registration attempts. Please wait and try again.'
            : e.details
              ? ''
              : e.status >= 500
                ? 'Registration is temporarily unavailable. Please try again.'
                : e.message,
        );
      } else setError('Registration failed.');
    }
  }
  return (
    <main className="grid min-h-screen place-items-center">
      <form onSubmit={submit} className="card w-full max-w-md space-y-4 p-8">
        <h1 className="text-2xl font-semibold">Create your account</h1>
        <input required name="name" className="field" placeholder="Name" />
        {fieldErrors.name?.map((message) => (
          <p key={message} role="alert" className="text-sm text-red-600">
            {message}
          </p>
        ))}
        <input
          required
          name="email"
          type="email"
          className="field"
          placeholder="Email"
        />
        {fieldErrors.email?.map((message) => (
          <p key={message} role="alert" className="text-sm text-red-600">
            {message}
          </p>
        ))}
        <input
          required
          minLength={8}
          name="password"
          type="password"
          className="field"
          placeholder="Password"
        />
        {fieldErrors.password?.map((message) => (
          <p key={message} role="alert" className="text-sm text-red-600">
            {message}
          </p>
        ))}
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
