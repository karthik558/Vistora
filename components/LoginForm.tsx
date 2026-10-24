"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [selectedRole, setSelectedRole] = useState<"admin" | "staff" | "visitor">("admin");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleQuickRole = async (role: "admin" | "staff" | "visitor") => {
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      let roleEmail = "rhea.menon@anantara.com";
      let roleName = "Rhea Menon";
      if (role === "staff") {
        roleEmail = "somchai.operations@anantara.com";
        roleName = "Somchai Tan";
      } else if (role === "visitor") {
        roleEmail = "visitor.preview@vistora.guest";
        roleName = "Guest Visitor";
      }

      setEmail(roleEmail);
      setPassword("Password123!");
      setSelectedRole(role);

      // Sign up or sign in
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: roleEmail,
          password: "Password123!",
          fullName: roleName,
          role,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        // If user already exists, sign in directly
        const loginRes = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: roleEmail,
            password: "Password123!",
          }),
        });
        const loginData = await loginRes.json();
        if (!loginRes.ok || !loginData.success) {
          throw new Error(loginData.error || "Authentication failed");
        }
      }

      setSuccess(`Signed in as ${role.toUpperCase()} (${roleName}). Redirecting…`);
      setTimeout(() => {
        router.push("/dashboard");
        router.refresh();
      }, 600);
    } catch (err: any) {
      setError(err.message || "Failed to switch role");
    } finally {
      setLoading(false);
    }
  };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const endpoint = mode === "signin" ? "/api/auth/login" : "/api/auth/signup";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          fullName: fullName.trim() || undefined,
          role: selectedRole,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Authentication failed");
      }

      setSuccess(
        mode === "signin"
          ? "Authenticated successfully. Redirecting to workspace…"
          : `Account created with role ${selectedRole.toUpperCase()}. Redirecting…`
      );

      setTimeout(() => {
        router.push("/dashboard");
        router.refresh();
      }, 700);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
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
            <strong style={{ fontSize: "16px", letterSpacing: "0.1em", textTransform: "uppercase" }}>VISTORA</strong>
          </div>
          <Link href="/" className="text-link" style={{ fontSize: "11px" }}>
            ← Back to Home
          </Link>
        </div>

        {/* Supabase status indicator */}
        <div className="auth-banner">
          <span className="dot" />
          <span>Supabase RBAC Active · ralbhldjygvdwjfrgufx.supabase.co</span>
        </div>

        <h1 className="auth-title">
          {mode === "signin" ? "Operations Workspace" : "Create Operations Account"}
        </h1>
        <p className="auth-sub">
          {mode === "signin"
            ? "Authenticate with your role-based Supabase credentials (Admin, Staff, or Visitor)."
            : "Register a new profile in Supabase with customized role-based permissions."}
        </p>

        {/* Mode switcher tabs */}
        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${mode === "signin" ? "active" : ""}`}
            onClick={() => {
              setMode("signin");
              setError(null);
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`auth-tab ${mode === "signup" ? "active" : ""}`}
            onClick={() => {
              setMode("signup");
              setError(null);
            }}
          >
            Create Account
          </button>
        </div>

        {/* Notices */}
        {error && <div className="auth-error">{error}</div>}
        {success && <div className="auth-success">{success}</div>}

        <form onSubmit={handleSubmit}>
          {mode === "signup" && (
            <>
              <div className="auth-field">
                <label className="field-label" htmlFor="auth-name">
                  Full Name
                </label>
                <input
                  id="auth-name"
                  className="auth-input"
                  type="text"
                  placeholder="Rhea Menon"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required={mode === "signup"}
                />
              </div>

              <div className="auth-field">
                <label className="field-label" htmlFor="auth-role">
                  Operational Role (RBAC)
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px", marginTop: "6px" }}>
                  <button
                    type="button"
                    onClick={() => setSelectedRole("admin")}
                    style={{
                      padding: "10px 6px",
                      borderRadius: "6px",
                      border: selectedRole === "admin" ? "2px solid #254230" : "1px solid var(--line)",
                      background: selectedRole === "admin" ? "#edf4ed" : "#fafbfa",
                      cursor: "pointer",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: "16px" }}>👑</div>
                    <strong style={{ display: "block", fontSize: "11px", color: "#254230", marginTop: "2px" }}>Admin</strong>
                    <small style={{ fontSize: "9px", color: "var(--muted)" }}>Full control</small>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedRole("staff")}
                    style={{
                      padding: "10px 6px",
                      borderRadius: "6px",
                      border: selectedRole === "staff" ? "2px solid #c59b58" : "1px solid var(--line)",
                      background: selectedRole === "staff" ? "#fbf5e6" : "#fafbfa",
                      cursor: "pointer",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: "16px" }}>🛎️</div>
                    <strong style={{ display: "block", fontSize: "11px", color: "#8c6827", marginTop: "2px" }}>Staff</strong>
                    <small style={{ fontSize: "9px", color: "var(--muted)" }}>Triage & notes</small>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedRole("visitor")}
                    style={{
                      padding: "10px 6px",
                      borderRadius: "6px",
                      border: selectedRole === "visitor" ? "2px solid #4a7590" : "1px solid var(--line)",
                      background: selectedRole === "visitor" ? "#eef4f8" : "#fafbfa",
                      cursor: "pointer",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: "16px" }}>👁️</div>
                    <strong style={{ display: "block", fontSize: "11px", color: "#3b5f75", marginTop: "2px" }}>Visitor</strong>
                    <small style={{ fontSize: "9px", color: "var(--muted)" }}>Read-only</small>
                  </button>
                </div>
              </div>
            </>
          )}

          <div className="auth-field">
            <label className="field-label" htmlFor="auth-email">
              Work Email
            </label>
            <input
              id="auth-email"
              className="auth-input"
              type="email"
              placeholder="rhea.menon@anantara.com"
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
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="button button-dark"
            disabled={loading}
            style={{ width: "100%", marginTop: "10px", padding: "12px", fontSize: "12px" }}
          >
            {loading ? "Connecting to Supabase…" : mode === "signin" ? "Sign In to Workspace →" : "Create Account →"}
          </button>
        </form>

        {/* 1-Click Role Testing Buttons */}
        <div style={{ marginTop: "24px", borderTop: "1px solid var(--line)", paddingTop: "18px" }}>
          <p style={{ margin: "0 0 10px", fontSize: "11px", fontWeight: 600, color: "var(--ink)", textAlign: "center" }}>
            Instant Role Test (1-Click Supabase Auth):
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
            <button
              type="button"
              className="demo-quick-btn"
              disabled={loading}
              onClick={() => handleQuickRole("admin")}
              title="Sign in as General Manager (Admin)"
            >
              👑 <b>Admin</b>
              <small style={{ display: "block", fontSize: "9px", color: "var(--muted)" }}>General Manager</small>
            </button>
            <button
              type="button"
              className="demo-quick-btn"
              disabled={loading}
              onClick={() => handleQuickRole("staff")}
              title="Sign in as Operations Lead (Staff)"
            >
              🛎️ <b>Staff</b>
              <small style={{ display: "block", fontSize: "9px", color: "var(--muted)" }}>Operations Lead</small>
            </button>
            <button
              type="button"
              className="demo-quick-btn"
              disabled={loading}
              onClick={() => handleQuickRole("visitor")}
              title="Sign in as Guest Visitor (Read-only)"
            >
              👁️ <b>Visitor</b>
              <small style={{ display: "block", fontSize: "9px", color: "var(--muted)" }}>Read-Only Auditor</small>
            </button>
          </div>
        </div>

        <p style={{ margin: "16px 0 0", textAlign: "center", fontSize: "10px", color: "var(--muted)" }}>
          Row-Level Security &amp; Profiles enforced by Supabase.
        </p>
      </div>
    </main>
  );
}
