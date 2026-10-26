"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff } from "lucide-react";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    // Public login page is strictly light mode
    document.documentElement.setAttribute("data-theme", "light");
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Authentication failed. Please check your credentials.");
      }

      if (typeof window !== "undefined" && data.user) {
        try {
          localStorage.setItem("vistora-user", JSON.stringify(data.user));
        } catch {}
      }

      router.replace(data.needsOnboarding?"/start":"/dashboard");
    } catch (err: any) {
      setError(err.message || "Failed to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <div className="auth-frame">
        <section className="auth-visual" aria-label="Architectural illustration of a quiet hotel courtyard">
          <img src="/courtyard.svg" alt="Sunlit hotel courtyard overlooking a reflecting pool" className="auth-courtyard" />
        </section>

        <section className="auth-card">
          <div className="auth-brand-row">
            <Link href="/" title="Vistora Home" className="auth-logo-link">
              <Image src="/logo1.webp" alt="Vistora" width={130} height={34} priority />
            </Link>
          </div>

          <div className="auth-heading-wrap">
            <h1 className="auth-title">Welcome back</h1>
            <p className="auth-sub">Sign in to your workspace.</p>
          </div>

          {error && <div className="auth-error" role="alert">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="auth-field">
              <label className="field-label" htmlFor="auth-email">Work email</label>
              <input id="auth-email" className="auth-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" required autoComplete="email" />
            </div>

            <div className="auth-field">
              <label className="field-label" htmlFor="auth-password">Password</label>
              <div className="password-input-wrap">
                <input id="auth-password" className="auth-input" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required autoComplete="current-password" />
                <button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <button type="submit" className="button button-dark auth-submit" disabled={loading}>
              {loading ? "Signing in…" : <><span>Sign in</span><ArrowRight size={16} /></>}
            </button>
          </form>

          <Link href="/start" className="auth-home-link">Create workspace</Link>
          <Link href="/" className="auth-home-link">← Return home</Link>
        </section>
      </div>
    </main>
  );
}
