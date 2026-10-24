"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<"admin" | "staff" | "visitor">("admin");
  const [email, setEmail] = useState("rhea.menon@anantara.com");
  const [password, setPassword] = useState("••••••••••••");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRoleSelect = (role: "admin" | "staff" | "visitor") => {
    setSelectedRole(role);
    setError(null);
    if (role === "admin") {
      setEmail("rhea.menon@anantara.com");
      setPassword("••••••••••••");
    } else if (role === "staff") {
      setEmail("somchai.operations@anantara.com");
      setPassword("••••••••••••");
    } else {
      setEmail("visitor.preview@vistora.guest");
      setPassword("••••••••••••");
    }
  };

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
          password: password === "••••••••••••" ? "Password123!" : password,
          role: selectedRole,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Authentication failed. Please verify your credentials.");
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
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div className="brand-mark">V</div>
            <strong style={{ fontSize: "16px", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              VISTORA
            </strong>
          </div>
          <Link href="/" className="text-link" style={{ fontSize: "11px" }}>
            ← Home
          </Link>
        </div>

        <h1 className="auth-title">Operations Workspace</h1>
        <p className="auth-sub">
          Select your operational role and sign in to manage guest experience and service recovery.
        </p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          {/* Role selector */}
          <div className="auth-field">
            <label className="field-label">Select Workspace Role</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginTop: "6px" }}>
              <button
                type="button"
                onClick={() => handleRoleSelect("admin")}
                style={{
                  padding: "12px 6px",
                  borderRadius: "6px",
                  border: selectedRole === "admin" ? "2px solid #254230" : "1px solid var(--line)",
                  background: selectedRole === "admin" ? "#edf4ed" : "#fafbfa",
                  cursor: "pointer",
                  textAlign: "center",
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ fontSize: "18px" }}>👑</div>
                <strong style={{ display: "block", fontSize: "11px", color: "#254230", marginTop: "4px" }}>
                  Admin
                </strong>
                <small style={{ fontSize: "9px", color: "var(--muted)" }}>General Manager</small>
              </button>

              <button
                type="button"
                onClick={() => handleRoleSelect("staff")}
                style={{
                  padding: "12px 6px",
                  borderRadius: "6px",
                  border: selectedRole === "staff" ? "2px solid #c59b58" : "1px solid var(--line)",
                  background: selectedRole === "staff" ? "#fbf5e6" : "#fafbfa",
                  cursor: "pointer",
                  textAlign: "center",
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ fontSize: "18px" }}>🛎️</div>
                <strong style={{ display: "block", fontSize: "11px", color: "#8c6827", marginTop: "4px" }}>
                  Staff
                </strong>
                <small style={{ fontSize: "9px", color: "var(--muted)" }}>Operations Lead</small>
              </button>

              <button
                type="button"
                onClick={() => handleRoleSelect("visitor")}
                style={{
                  padding: "12px 6px",
                  borderRadius: "6px",
                  border: selectedRole === "visitor" ? "2px solid #4a7590" : "1px solid var(--line)",
                  background: selectedRole === "visitor" ? "#eef4f8" : "#fafbfa",
                  cursor: "pointer",
                  textAlign: "center",
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ fontSize: "18px" }}>👁️</div>
                <strong style={{ display: "block", fontSize: "11px", color: "#3b5f75", marginTop: "4px" }}>
                  Visitor
                </strong>
                <small style={{ fontSize: "9px", color: "var(--muted)" }}>Read-Only Preview</small>
              </button>
            </div>
          </div>

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
              required
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
              required
            />
          </div>

          <button
            type="submit"
            className="button button-dark"
            disabled={loading}
            style={{ width: "100%", marginTop: "12px", padding: "13px", fontSize: "12px" }}
          >
            {loading ? "Authenticating…" : `Enter as ${selectedRole.toUpperCase()} →`}
          </button>
        </form>
      </div>
    </main>
  );
}
