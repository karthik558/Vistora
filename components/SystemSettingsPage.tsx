"use client";

import { useEffect, useState } from "react";
import {
  Settings,
  Building2,
  ShieldAlert,
  Save,
  Check,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  Globe,
  Clock,
  Mail,
  Sliders,
  CheckCircle2,
} from "lucide-react";
import { AppShell, WorkspaceUser, getClientUser, fetchLatestSession } from "./Dashboard";
import { PropertyRow } from "../types/experience";
import CustomSelect from "./CustomSelect";
import { ApplicationSettings, PropertySettingConfig } from "../lib/services/settingsService";

export default function SystemSettingsPage({
  initialUser,
  properties = [],
}: {
  initialUser?: WorkspaceUser | null;
  properties?: PropertyRow[];
}) {
  const [user, setUser] = useState<WorkspaceUser | null>(
    () => initialUser || (typeof window !== "undefined" ? getClientUser() : null)
  );
  const [activeTab, setActiveTab] = useState<"application" | "property">("application");
  const [loading, setLoading] = useState(true);
  const [savedSuccess, setSavedSuccess] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

  // Property Settings State
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>(properties[0]?.id || "");
  const [propSettings, setPropSettings] = useState<PropertySettingConfig>({
    propertyId: properties[0]?.id || "",
    propertyName: properties[0]?.name || "Vistora Riverside Bangkok",
    propertyCode: properties[0]?.code || "VRB",
    brand: properties[0]?.brand || "Vistora Hotels & Resorts",
    isActive: true,
    totalRooms: properties[0]?.total_rooms || 280,
    location: properties[0]?.location || "Bangkok, Thailand",
    contactEmail: "concierge@vistora.app",
    contactPhone: "+66 2 123 4567",
    welcomeMessage: "Welcome to Vistora. Your stay is our highest priority.",
  });

  const [saving, setSaving] = useState(false);

  const isAdmin =
    user?.role === "admin" ||
    user?.role === "super_admin" ||
    user?.orgRole === "admin" ||
    user?.orgRole === "super_admin";

  const allowedPropertyIds = isAdmin
    ? null
    : user?.propertyIds?.length
    ? user.propertyIds
    : user?.propertyId
    ? [user.propertyId]
    : [];

  const visibleProperties = properties.filter((p) => {
    if (allowedPropertyIds === null) return true;
    return allowedPropertyIds.includes(p.id);
  });

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
      if (json.success) {
        if (json.appSettings) setAppSettings(json.appSettings);
        if (json.propertySettings && Array.isArray(json.propertySettings)) {
          const match = json.propertySettings.find((p: any) => p.propertyId === selectedPropertyId);
          if (match) setPropSettings(match);
        }
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }

  // When selected property changes, load its settings
  async function handlePropertySelect(propId: string) {
    setSelectedPropertyId(propId);
    try {
      const res = await fetch(`/api/settings?propertyId=${propId}`);
      const json = await res.json();
      if (json.success && json.propertySetting) {
        setPropSettings(json.propertySetting);
      } else {
        const found = properties.find((p) => p.id === propId);
        if (found) {
          setPropSettings({
            propertyId: found.id,
            propertyName: found.name,
            propertyCode: found.code,
            brand: found.brand,
            isActive: (found as any).is_active !== false,
            totalRooms: found.total_rooms,
            location: `${found.location}, ${found.country}`,
            contactEmail: `${found.code.toLowerCase()}@vistora.app`,
            contactPhone: "",
            welcomeMessage: `Welcome to ${found.name}.`,
          });
        }
      }
    } catch {}
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
        setSavedSuccess("Application settings updated successfully.");
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

  async function handleSavePropertySettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    setSavedSuccess(null);

    try {
      // 1. Save property configuration
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "property",
          propertyId: selectedPropertyId,
          propertySetting: propSettings,
        }),
      });

      // 2. Also sync active status and basic info to properties table
      await fetch("/api/properties", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: selectedPropertyId,
          name: propSettings.propertyName,
          code: propSettings.propertyCode,
          brand: propSettings.brand,
          totalRooms: propSettings.totalRooms,
          isActive: propSettings.isActive,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setSavedSuccess(`Settings for "${propSettings.propertyName}" saved.`);
        setTimeout(() => setSavedSuccess(null), 3500);
      } else {
        setErrorMsg(json.error || "Failed to update property settings.");
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
            <h1>System &amp; property settings</h1>
            <p className="subheading">
              Manage organization-level platform defaults, SLA thresholds, and individual property operational parameters.
            </p>
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

        {/* Tab Switcher */}
        <div style={{ display: "flex", gap: "12px", borderBottom: "1px solid var(--line)", marginBottom: "24px" }}>
          <button
            type="button"
            onClick={() => setActiveTab("application")}
            style={{
              padding: "12px 20px",
              fontSize: "13px",
              fontWeight: 600,
              background: "transparent",
              border: "none",
              borderBottom: activeTab === "application" ? "2px solid var(--ink)" : "2px solid transparent",
              color: activeTab === "application" ? "var(--ink)" : "var(--muted)",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <Sliders size={15} />
            <span>Application Settings (Admin Only)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("property")}
            style={{
              padding: "12px 20px",
              fontSize: "13px",
              fontWeight: 600,
              background: "transparent",
              border: "none",
              borderBottom: activeTab === "property" ? "2px solid var(--ink)" : "2px solid transparent",
              color: activeTab === "property" ? "var(--ink)" : "var(--muted)",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <Building2 size={15} />
            <span>Property Settings</span>
          </button>
        </div>

        {/* Tab 1: Application Settings */}
        {activeTab === "application" && (
          <div>
            {!isAdmin ? (
              <div className="panel" style={{ padding: "48px 24px", textAlign: "center", maxWidth: "600px", margin: "0 auto" }}>
                <ShieldAlert size={36} style={{ color: "var(--amber)", margin: "0 auto 12px" }} />
                <h3>Administrator Access Strictly Required</h3>
                <p style={{ color: "var(--muted)", fontSize: "13px", lineHeight: "1.6" }}>
                  Application settings control global organization naming, project titles, and platform-wide SLA parameters. Only verified Administrators and Super Administrators can modify these values.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSaveAppSettings}>
                <div className="panel" style={{ padding: "28px", maxWidth: "800px" }}>
                  <div style={{ marginBottom: "24px", borderBottom: "1px solid var(--line)", paddingBottom: "16px" }}>
                    <h3 style={{ margin: "0 0 6px" }}>Organization &amp; Project Identity</h3>
                    <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)" }}>
                      Display credentials used across dashboard breadcrumbs, export headers, and guest notices.
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
                        required
                      />
                    </div>

                    <div>
                      <label className="field-label" style={{ display: "block", marginBottom: "6px" }}>
                        Project Name *
                      </label>
                      <input
                        type="text"
                        className="auth-input"
                        value={appSettings.projectName}
                        onChange={(e) => setAppSettings({ ...appSettings, projectName: e.target.value })}
                        required
                      />
                    </div>

                    <div>
                      <label className="field-label" style={{ display: "block", marginBottom: "6px" }}>
                        Brand Tagline
                      </label>
                      <input
                        type="text"
                        className="auth-input"
                        value={appSettings.brandTagline}
                        onChange={(e) => setAppSettings({ ...appSettings, brandTagline: e.target.value })}
                      />
                    </div>
                  </div>

                  <div style={{ margin: "32px 0 24px", borderBottom: "1px solid var(--line)", paddingBottom: "16px" }}>
                    <h3 style={{ margin: "0 0 6px" }}>Global SLA Recovery Targets</h3>
                    <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)" }}>
                      Response and resolution countdown limits for guest complaints and service recovery.
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
                        Target for 1★ and 2★ urgent escalations (default: 15 min).
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
                        Target for full service resolution &amp; guest closure (default: 120 min).
                      </small>
                    </div>
                  </div>

                  <div style={{ marginTop: "24px" }}>
                    <label className="field-label" style={{ display: "block", marginBottom: "6px" }}>
                      Executive Alert Dispatch Email
                    </label>
                    <input
                      type="email"
                      className="auth-input"
                      value={appSettings.alertEmail}
                      onChange={(e) => setAppSettings({ ...appSettings, alertEmail: e.target.value })}
                    />
                  </div>

                  <div style={{ marginTop: "28px", display: "flex", justifyContent: "flex-end" }}>
                    <button
                      type="submit"
                      disabled={saving}
                      className="button button-dark"
                      style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
                    >
                      <Save size={15} />
                      <span>{saving ? "Saving Changes…" : "Save Application Settings"}</span>
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Tab 2: Property Settings */}
        {activeTab === "property" && (
          <div>
            <div className="panel" style={{ padding: "28px", maxWidth: "800px" }}>
              <div style={{ marginBottom: "24px", borderBottom: "1px solid var(--line)", paddingBottom: "16px" }}>
                <label className="field-label" style={{ display: "block", marginBottom: "8px" }}>
                  Select Property to Configure
                </label>
                <CustomSelect
                  value={selectedPropertyId}
                  onChange={(val) => handlePropertySelect(val)}
                  placeholder="Select property"
                  options={visibleProperties.map((p) => ({
                    value: p.id,
                    label: `${p.name} (${p.code})`,
                    detail: `${p.location} · ${p.total_rooms || 0} rooms`,
                  }))}
                />
              </div>

              <form onSubmit={handleSavePropertySettings}>
                <div style={{ display: "grid", gap: "18px" }}>
                  {/* Active / Disabled Status Toggle */}
                  <div
                    style={{
                      padding: "16px 20px",
                      background: propSettings.isActive ? "var(--sage-soft)" : "var(--red-soft)",
                      border: `1px solid ${propSettings.isActive ? "var(--line)" : "var(--red)"}`,
                      borderRadius: "8px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <strong style={{ display: "block", fontSize: "13px", color: propSettings.isActive ? "var(--sage-deep)" : "var(--red)" }}>
                        Property Operational Status: {propSettings.isActive ? "ACTIVE & LIVE" : "DISABLED / INACTIVE"}
                      </strong>
                      <p style={{ margin: "4px 0 0", fontSize: "11px", color: "var(--muted)" }}>
                        {propSettings.isActive
                          ? "This hotel location is fully active. Guests can select it in public forms and scan QR touchpoints."
                          : "This property is disabled. It is completely hidden from public guest feedback forms."}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPropSettings({ ...propSettings, isActive: !propSettings.isActive })}
                      style={{
                        padding: "8px 16px",
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
                      {propSettings.isActive ? <ToggleRight size={18} style={{ color: "var(--sage)" }} /> : <ToggleLeft size={18} style={{ color: "var(--red)" }} />}
                      <span>{propSettings.isActive ? "Make Disabled" : "Make Active"}</span>
                    </button>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "16px" }}>
                    <div>
                      <label className="field-label" style={{ display: "block", marginBottom: "6px" }}>
                        Property Name *
                      </label>
                      <input
                        type="text"
                        className="auth-input"
                        value={propSettings.propertyName}
                        onChange={(e) => setPropSettings({ ...propSettings, propertyName: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label className="field-label" style={{ display: "block", marginBottom: "6px" }}>
                        Property Code *
                      </label>
                      <input
                        type="text"
                        className="auth-input"
                        value={propSettings.propertyCode}
                        onChange={(e) => setPropSettings({ ...propSettings, propertyCode: e.target.value.toUpperCase() })}
                        required
                      />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <div>
                      <label className="field-label" style={{ display: "block", marginBottom: "6px" }}>
                        Brand / Collection
                      </label>
                      <input
                        type="text"
                        className="auth-input"
                        value={propSettings.brand}
                        onChange={(e) => setPropSettings({ ...propSettings, brand: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="field-label" style={{ display: "block", marginBottom: "6px" }}>
                        Total Guest Rooms
                      </label>
                      <input
                        type="number"
                        className="auth-input"
                        value={propSettings.totalRooms}
                        onChange={(e) => setPropSettings({ ...propSettings, totalRooms: parseInt(e.target.value, 10) || 100 })}
                      />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <div>
                      <label className="field-label" style={{ display: "block", marginBottom: "6px" }}>
                        Front Desk &amp; Concierge Email
                      </label>
                      <input
                        type="email"
                        className="auth-input"
                        value={propSettings.contactEmail}
                        onChange={(e) => setPropSettings({ ...propSettings, contactEmail: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="field-label" style={{ display: "block", marginBottom: "6px" }}>
                        Direct Duty Phone
                      </label>
                      <input
                        type="tel"
                        className="auth-input"
                        value={propSettings.contactPhone}
                        onChange={(e) => setPropSettings({ ...propSettings, contactPhone: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="field-label" style={{ display: "block", marginBottom: "6px" }}>
                      Guest Welcome Message
                    </label>
                    <textarea
                      className="auth-input"
                      rows={3}
                      value={propSettings.welcomeMessage}
                      onChange={(e) => setPropSettings({ ...propSettings, welcomeMessage: e.target.value })}
                    />
                  </div>

                  <div style={{ marginTop: "20px", display: "flex", justifyContent: "flex-end" }}>
                    <button
                      type="submit"
                      disabled={saving}
                      className="button button-dark"
                      style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
                    >
                      <Save size={15} />
                      <span>{saving ? "Saving Property Settings…" : "Save Property Settings"}</span>
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
