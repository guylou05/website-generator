import { ArrowRight, Github, Sparkles } from 'lucide-react';
import Link from 'next/link';
export default function Login() {
  return (
    <main className="login-page">
      <div className="login-glow" />
      <section className="login-card">
        <div className="login-brand">
          <span className="brand-mark">
            <Sparkles size={17} />
          </span>
          <strong>Foundry</strong>
        </div>
        <div className="login-copy">
          <span className="pill">Website generation, refined</span>
          <h1>Welcome back</h1>
          <p>Sign in to create, publish, and manage exceptional websites.</p>
        </div>
        <form className="login-form">
          <label>
            Email address
            <input
              type="email"
              placeholder="you@company.com"
              autoComplete="email"
            />
          </label>
          <label>
            <span>
              Password <a href="#">Forgot password?</a>
            </span>
            <input
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </label>
          <Link
            href="/dashboard"
            className="button button-primary login-submit"
          >
            Continue <ArrowRight size={16} />
          </Link>
        </form>
        <div className="or">
          <span>or continue with</span>
        </div>
        <button className="button button-secondary login-submit">
          <Github size={17} />
          GitHub
        </button>
        <p className="login-footer">
          New to Foundry? <a href="#">Create an account</a>
        </p>
      </section>
      <p className="login-legal">
        By continuing, you agree to our Terms and Privacy Policy.
      </p>
    </main>
  );
}
