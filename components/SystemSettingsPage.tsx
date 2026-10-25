"use client";

import { useEffect, useState } from "react";
import {
  ShieldAlert,
  Save,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  Globe,
  Clock,
  Mail,
  Sliders,
  CheckCircle2,
  Building2,
} from "lucide-react";
import Link from "next/link";
import { AppShell, WorkspaceUser, getClientUser, fetchLatestSession } from "./Dashboard";
import { PropertyRow } from "../types/experience";
import { ApplicationSettings } from "../lib/services/settingsService";

export default function SystemSettingsPage({
  initialUser,
}: {
  initialUser?: WorkspaceUser | null;
  properties?: PropertyRow[];
}) {
  const [user, setUser] = useState<WorkspaceUser | null>(
    () => initialUser || (typeof window !== "undefined" ? getClientUser() : null)
  );
  const [loading, setLoading] = useState(true);
  const [savedSuccess, setSavedSuccess] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Application Settings State
  const [appSettings, setAppSettings] = useState<ApplicationSettings>({
    organizationName: "Vistora Hospitality Collection",
    projectName: "Vistora Guest Experience Platform",
    brandTagline: "Luxury Hospitality Service Recovery & CSAT Intelligence",
    slaCriticalMinutes: 15,
    slaStandardMinutes: 120,
    autoGuestFollowUp: true,
    alertEmail: "operations@vistora.app",
    defaultTimezone: "Asia/Bangkok",
    dataRetentionDays: 365,
  });

  const isAdmin =
    user?.role === "admin" ||
    user?.role === "super_admin" ||
    user?.orgRole === "admin" ||
    user?.orgRole === "super_admin";

  useEffect(() => {
    const local = getClientUser();
    if (local && !user) setUser(local);

    fetchLatestSession()
      .then((data) => {
        if (data?.success && data?.user) setUser(data.user);
      })
      .catch(() => {});

    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    try {
      const res = await fetch("/api/settings");
      const json = await res.json();
      if (json.success && json.appSettings) {
        setAppSettings(json.appSettings);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveAppSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    setSavedSuccess(null);

    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "application",
          appSettings,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSavedSuccess("System & application settings saved successfully.");
        setTimeout(() => setSavedSuccess(null), 3500);
      } else {
        setErrorMsg(json.error || "Failed to update settings.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell active="System settings" user={user}>
      <div className="content-wrap">
        <div className="page-heading">
          <div>
            <p className="eyebrow">Enterprise Configuration</p>
            <h1>System settings</h1>
            <p className="subheading">
              Manage global platform parameters, brand identity, SLA recovery targets, and retention policies.
            </p>
          </div>
          <div className="page-heading-actions">
            <Link
              href="/dashboard/properties"
              className="button button-outline compact"
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              title="Manage individual hotel property configurations"
            >
              <Building2 size={13} />
              <span>Go to Properties section ↗</span>
            </Link>
          </div>
        </div>

        {/* Status Toast */}
        {savedSuccess && (
          <div
            style={{
              padding: "12px 18px",
              background: "var(--sage-soft)",
              color: "var(--sage-deep)",
              borderRadius: "6px",
              border: "1px solid var(--sage)",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "20px",
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            <CheckCircle2 size={16} />
            <span>{savedSuccess}</span>
          </div>
        )}
        {errorMsg && (
          <div
            style={{
              padding: "12px 18px",
              background: "var(--red-soft)",
              color: "var(--red)",
              borderRadius: "6px",
              border: "1px solid var(--red)",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "20px",
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Application Settings Section */}
        <div>
          {!isAdmin ? (
            <div className="panel" style={{ padding: "48px 24px", textAlign: "center", maxWidth: "600px", margin: "40px auto" }}>
              <ShieldAlert size={36} style={{ color: "var(--amber)", margin: "0 auto 12px" }} />
              <h3 style={{ fontSize: "18px", margin: "0 0 8px" }}>Administrator Access Required</h3>
              <p style={{ color: "var(--muted)", fontSize: "13px", lineHeight: "1.6" }}>
                System settings control global organization naming, project titles, and platform-wide SLA parameters. Only verified Administrators can modify these parameters.
              </p>
            </div>
          ) : loading ? (
            <div className="panel loading-panel" aria-busy="true">
              <span className="table-loading-bar" />
              <span className="table-loading-bar short" />
              <span className="table-loading-bar" />
              <span className="sr-only">Loading system settings</span>
            </div>
          ) : (
            <form onSubmit={handleSaveAppSettings}>
              <div className="panel" style={{ padding: "28px", maxWidth: "860px" }}>
                {/* Organization Identity */}
                <div style={{ marginBottom: "24px", borderBottom: "1px solid var(--line)", paddingBottom: "16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <Sliders size={16} style={{ color: "var(--ink)" }} />
                    <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 600 }}>Organization &amp; Project Identity</h3>
                  </div>
                  <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)" }}>
                    Display credentials used across dashboard breadcrumbs, export headers, and guest communications.
                  </p>
                </div>

                <div style={{ display: "grid", gap: "18px" }}>
                  <div>
                    <label className="field-label" style={{ display: "block", marginBottom: "6px" }}>
                      Organization Name *
                    </label>
                    <input
                      type="text"
                      className="auth-input"
                      value={appSettings.organizationName}
                      onChange={(e) => setAppSettings({ ...appSettings, organizationName: e.target.value })}
                      placeholder="e.g. Vistora Hospitality Collection"
                      required
                    />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <div>
                      <label className="field-label" style={{ display: "block", marginBottom: "6px" }}>
                        Platform / Project Name *
                      </label>
                      <input
                        type="text"
                        className="auth-input"
                        value={appSettings.projectName}
                        onChange={(e) => setAppSettings({ ...appSettings, projectName: e.target.value })}
                        placeholder="e.g. Vistora Guest Experience Platform"
                        required
                      />
                    </div>
                    <div>
                      <label className="field-label" style={{ display: "block", marginBottom: "6px" }}>
                        Luxury Brand Tagline
                      </label>
                      <input
                        type="text"
                        className="auth-input"
                        value={appSettings.brandTagline}
                        onChange={(e) => setAppSettings({ ...appSettings, brandTagline: e.target.value })}
                        placeholder="e.g. Luxury Hospitality Service Recovery"
                      />
                    </div>
                  </div>
                </div>

                {/* Global SLA Recovery Targets */}
                <div style={{ margin: "32px 0 20px", borderBottom: "1px solid var(--line)", paddingBottom: "16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <Clock size={16} style={{ color: "var(--ink)" }} />
                    <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 600 }}>Global SLA Recovery Targets</h3>
                  </div>
                  <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)" }}>
                    Hospitality emergency escalation thresholds for 1★ and 2★ reviews.
                  </p>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px" }}>
                  <div>
                    <label className="field-label" style={{ display: "block", marginBottom: "6px" }}>
                      Critical Complaint Response SLA (Minutes) *
                    </label>
                    <input
                      type="number"
                      min={5}
                      max={120}
                      className="auth-input"
                      value={appSettings.slaCriticalMinutes}
                      onChange={(e) => setAppSettings({ ...appSettings, slaCriticalMinutes: parseInt(e.target.value, 10) || 15 })}
                      required
                    />
                    <small style={{ color: "var(--muted)", fontSize: "11px", marginTop: "4px", display: "block" }}>
                      Countdown target for immediate manager contact on negative reviews (default: 15 min).
                    </small>
                  </div>

                  <div>
                    <label className="field-label" style={{ display: "block", marginBottom: "6px" }}>
                      Standard Resolution SLA (Minutes) *
                    </label>
                    <input
                      type="number"
                      min={30}
                      max={1440}
                      className="auth-input"
                      value={appSettings.slaStandardMinutes}
                      onChange={(e) => setAppSettings({ ...appSettings, slaStandardMinutes: parseInt(e.target.value, 10) || 120 })}
                      required
                    />
                    <small style={{ color: "var(--muted)", fontSize: "11px", marginTop: "4px", display: "block" }}>
                      Full incident resolution &amp; guest satisfaction sign-off target (default: 120 min).
                    </small>
                  </div>
                </div>

                {/* Notifications & System Policies */}
                <div style={{ margin: "32px 0 20px", borderBottom: "1px solid var(--line)", paddingBottom: "16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <Mail size={16} style={{ color: "var(--ink)" }} />
                    <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 600 }}>System Notifications &amp; Policies</h3>
                  </div>
                  <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)" }}>
                    Automated email dispatch, retention rules, and regional time settings.
                  </p>
                </div>

                <div style={{ display: "grid", gap: "18px" }}>
                  <div>
                    <label className="field-label" style={{ display: "block", marginBottom: "6px" }}>
                      Executive Alert Dispatch Email
                    </label>
                    <input
                      type="email"
                      className="auth-input"
                      value={appSettings.alertEmail}
                      onChange={(e) => setAppSettings({ ...appSettings, alertEmail: e.target.value })}
                      placeholder="e.g. operations@vistora.app"
                    />
                    <small style={{ color: "var(--muted)", fontSize: "11px", marginTop: "4px", display: "block" }}>
                      Receives urgent alerts whenever an unresolved critical complaint approaches SLA breach.
                    </small>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <div>
                      <label className="field-label" style={{ display: "block", marginBottom: "6px" }}>
                        Default Timezone
                      </label>
                      <input
                        type="text"
                        className="auth-input"
                        value={appSettings.defaultTimezone}
                        onChange={(e) => setAppSettings({ ...appSettings, defaultTimezone: e.target.value })}
                        placeholder="e.g. Asia/Bangkok, America/New_York"
                      />
                    </div>
                    <div>
                      <label className="field-label" style={{ display: "block", marginBottom: "6px" }}>
                        Data Retention Window (Days)
                      </label>
                      <input
                        type="number"
                        min={30}
                        max={3650}
                        className="auth-input"
                        value={appSettings.dataRetentionDays}
                        onChange={(e) => setAppSettings({ ...appSettings, dataRetentionDays: parseInt(e.target.value, 10) || 365 })}
                      />
                    </div>
                  </div>

                  {/* Automated Follow-up toggle */}
                  <div
                    style={{
                      padding: "16px 20px",
                      background: "var(--canvas-alt)",
                      border: "1px solid var(--line)",
                      borderRadius: "6px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginTop: "6px",
                    }}
                  >
                    <div>
                      <strong style={{ display: "block", fontSize: "13px", color: "var(--ink)" }}>
                        Automated Guest Service Recovery Follow-Up
                      </strong>
                      <p style={{ margin: "4px 0 0", fontSize: "11px", color: "var(--muted)" }}>
                        Automatically send digital apology and recovery voucher invitation when a critical review is logged.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAppSettings({ ...appSettings, autoGuestFollowUp: !appSettings.autoGuestFollowUp })}
                      style={{
                        padding: "6px 14px",
                        borderRadius: "5px",
                        border: "1px solid var(--line)",
                        background: "var(--panel)",
                        color: "var(--ink)",
                        fontWeight: 600,
                        fontSize: "12px",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      {appSettings.autoGuestFollowUp ? (
                        <ToggleRight size={18} style={{ color: "var(--sage)" }} />
                      ) : (
                        <ToggleLeft size={18} style={{ color: "var(--muted)" }} />
                      )}
                      <span>{appSettings.autoGuestFollowUp ? "Enabled" : "Disabled"}</span>
                    </button>
                  </div>
                </div>

                <div style={{ marginTop: "32px", display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="submit"
                    disabled={saving}
                    className="button button-dark"
                    style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "10px 24px" }}
                  >
                    <Save size={15} />
                    <span>{saving ? "Saving Changes…" : "Save System Settings"}</span>
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </AppShell>
  );
}
