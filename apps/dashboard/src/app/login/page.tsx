'use client';
import Link from 'next/link';
import { ArrowRight, Check, Eye, LockKeyhole } from 'lucide-react';
import { Logo } from '@/components/logo';

export default function Login() {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="flex flex-col p-6 sm:p-10">
        <Logo />
        <div className="m-auto w-full max-w-sm py-12">
          <h1 className="text-3xl font-semibold tracking-tight">
            Welcome back
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Sign in to continue building remarkable websites.
          </p>
          <button className="bg-card mt-8 flex w-full items-center justify-center gap-3 rounded-lg border py-2.5 text-sm font-medium shadow-sm">
            <span className="text-lg font-bold text-blue-500">G</span>Continue
            with Google
          </button>
          <div className="text-muted-foreground my-6 flex items-center gap-3 text-xs">
            <span className="bg-border h-px flex-1" />
            or continue with email
            <span className="bg-border h-px flex-1" />
          </div>
          <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
            <label className="block text-sm font-medium">
              Email address
              <input
                className="field mt-2"
                type="email"
                placeholder="you@company.com"
              />
            </label>
            <label className="block text-sm font-medium">
              Password
              <div className="relative mt-2">
                <input
                  className="field pr-10"
                  type="password"
                  placeholder="Enter your password"
                />
                <Eye className="text-muted-foreground absolute right-3 top-3 size-4" />
              </div>
            </label>
            <div className="flex justify-between text-sm">
              <label className="text-muted-foreground flex items-center gap-2">
                <input type="checkbox" />
                Remember me
              </label>
              <button className="text-primary font-medium">
                Forgot password?
              </button>
            </div>
            <Link
              href="/dashboard"
              className="bg-primary text-primary-foreground flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium"
            >
              Sign in <ArrowRight className="size-4" />
            </Link>
          </form>
          <p className="text-muted-foreground mt-7 text-center text-sm">
            New to SiteFoundry?{' '}
            <button className="text-primary font-medium">
              Create an account
            </button>
          </p>
        </div>
        <p className="text-muted-foreground text-xs">
          © 2026 SiteFoundry. All rights reserved.
        </p>
      </section>
      <section className="relative hidden overflow-hidden bg-slate-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-32 -top-32 size-96 rounded-full bg-violet-600/30 blur-3xl" />
        <div className="relative">
          <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs">
            AI-powered website creation
          </span>
          <h2 className="mt-8 max-w-xl text-5xl font-semibold leading-tight tracking-tight">
            From idea to live website in minutes.
          </h2>
          <p className="mt-5 max-w-lg text-lg text-slate-400">
            Create beautiful, conversion-ready websites tailored to your
            business—without touching a line of code.
          </p>
        </div>
        <div className="card relative border-white/10 bg-white/5 p-6 backdrop-blur">
          <div className="flex gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-violet-500/20">
              <LockKeyhole className="size-5 text-violet-300" />
            </span>
            <div>
              <p className="font-medium">
                Built for speed. Designed for growth.
              </p>
              {[
                'Smart content and design generation',
                'Production-ready WordPress websites',
                'Publish whenever you’re ready',
              ].map((x) => (
                <p
                  key={x}
                  className="mt-3 flex items-center gap-2 text-sm text-slate-400"
                >
                  <Check className="size-4 text-emerald-400" />
                  {x}
                </p>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
