"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password: password.trim(),
        }),
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

      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <div className="auth-card">
        {/* Brand row */}
        <div className="auth-brand-row">
          <Link href="/" title="Vistora Home" style={{ display: "inline-flex", alignItems: "center" }}>
            <Image
              src="/logo.webp"
              alt="Vistora"
              width={130}
              height={34}
              priority
              style={{ height: "30px", width: "auto", objectFit: "contain" }}
            />
          </Link>
          <Link href="/" className="text-link" style={{ fontSize: "11px" }}>
            ← Home
          </Link>
        </div>

        <h1 className="auth-title">Operations Workspace</h1>
        <p className="auth-sub">
          Sign in with your verified workspace credentials to access guest experience and service recovery.
        </p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            <label className="field-label" htmlFor="auth-email">
              Work Email
            </label>
            <input
              id="auth-email"
              className="auth-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="auth-field">
            <label className="field-label" htmlFor="auth-password">
              Password
            </label>
            <input
              id="auth-password"
              className="auth-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="button button-dark"
            disabled={loading}
            style={{ width: "100%", marginTop: "16px", padding: "13px", fontSize: "12px" }}
          >
            {loading ? "Verifying with Supabase…" : "Sign In to Workspace →"}
          </button>
        </form>
      </div>
    </main>
  );
}
