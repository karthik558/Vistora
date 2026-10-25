"use client";

import { useEffect, useState } from "react";
import { AppShell, WorkspaceUser, getClientUser, fetchLatestSession } from "./Dashboard";
import { Building2, Plus, Trash2, X, Check, Users, Settings, Power } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export interface PropertyItem {
  id: string;
  name: string;
  slug: string;
  code: string;
  brand: string;
  location: string;
  country: string;
  timezone: string;
  total_rooms: number;
  is_active?: boolean;
  created_at?: string;
  profiles?: Array<{
    id: string;
    full_name: string;
    email: string;
    role: string;
  }>;
}

interface UserOption {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

export default function PropertiesPage({ initialUser }: { initialUser?: WorkspaceUser | null }) {
  const [properties, setProperties] = useState<PropertyItem[]>([]);
  const [allUsers, setAllUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  // User session
  const [activeUser, setActiveUser] = useState<WorkspaceUser | null>(
    () => initialUser || (typeof window !== "undefined" ? getClientUser() : null)
  );
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(initialUser?.role || activeUser?.role || null);
  const [sessionLoading, setSessionLoading] = useState(!initialUser?.role && !activeUser?.role);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isUserAdmin = activeUser?.role === "admin" || currentUserRole === "admin";
  const userRights = new Set(Array.isArray(activeUser?.rights) ? activeUser.rights : []);
  const canManageProperties = isUserAdmin || userRights.has("manage_properties");

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [location, setLocation] = useState("Bangkok");
  const [country, setCountry] = useState("Thailand");
  const [brand, setBrand] = useState("Vistora Hotels & Resorts");
  const [totalRooms, setTotalRooms] = useState("200");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  // Property Settings Modal states (configured directly inside Properties section)
  const [selectedSettingProperty, setSelectedSettingProperty] = useState<PropertyItem | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [savingPropSettings, setSavingPropSettings] = useState(false);
  const [settingName, setSettingName] = useState("");
  const [settingCode, setSettingCode] = useState("");
  const [settingBrand, setSettingBrand] = useState("Vistora Hotels & Resorts");
  const [settingRooms, setSettingRooms] = useState("200");
  const [settingLocation, setSettingLocation] = useState("");
  const [settingEmail, setSettingEmail] = useState("");
  const [settingPhone, setSettingPhone] = useState("");
  const [settingWelcome, setSettingWelcome] = useState("");
  const [settingIsActive, setSettingIsActive] = useState(true);

  async function handleOpenSettings(prop: PropertyItem) {
    setSelectedSettingProperty(prop);
    setSettingName(prop.name);
    setSettingCode(prop.code);
    setSettingBrand(prop.brand || "Vistora Hotels & Resorts");
    setSettingRooms(String(prop.total_rooms || 200));
    setSettingLocation(`${prop.location}, ${prop.country}`);
    setSettingEmail(`${prop.code.toLowerCase()}@vistora.app`);
    setSettingPhone("");
    setSettingWelcome(`Welcome to ${prop.name}. Your comfort is our supreme honor.`);
    setSettingIsActive(prop.is_active !== false);
    setShowSettingsModal(true);

    try {
      const res = await fetch(`/api/settings?propertyId=${prop.id}`);
      const json = await res.json();
      if (json.success && json.propertySetting) {
        const s = json.propertySetting;
        if (s.propertyName) setSettingName(s.propertyName);
        if (s.propertyCode) setSettingCode(s.propertyCode);
        if (s.brand) setSettingBrand(s.brand);
        if (s.totalRooms) setSettingRooms(String(s.totalRooms));
        if (s.location) setSettingLocation(s.location);
        if (s.contactEmail) setSettingEmail(s.contactEmail);
        if (s.contactPhone) setSettingPhone(s.contactPhone);
        if (s.welcomeMessage) setSettingWelcome(s.welcomeMessage);
        if (typeof s.isActive === "boolean") setSettingIsActive(s.isActive);
      }
    } catch {}
  }

  async function handleSavePropertySettings(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSettingProperty) return;

    setSavingPropSettings(true);
    setError(null);
    setSuccess(null);

    try {
      const configObj = {
        propertyId: selectedSettingProperty.id,
        propertyName: settingName.trim(),
        propertyCode: settingCode.trim().toUpperCase(),
        brand: settingBrand.trim(),
        isActive: settingIsActive,
        totalRooms: parseInt(settingRooms, 10) || 100,
        location: settingLocation.trim(),
        contactEmail: settingEmail.trim(),
        contactPhone: settingPhone.trim(),
        welcomeMessage: settingWelcome.trim(),
      };

      // 1. Save to settings service
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "property",
          propertyId: selectedSettingProperty.id,
          propertySetting: configObj,
        }),
      });

      // 2. Also update properties table
      const resProp = await fetch("/api/properties", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: selectedSettingProperty.id,
          name: settingName.trim(),
          code: settingCode.trim().toUpperCase(),
          brand: settingBrand.trim(),
          totalRooms: parseInt(settingRooms, 10) || 100,
          isActive: settingIsActive,
        }),
      });

      const resJson = await resProp.json();
      if (!resProp.ok || !resJson.success) {
        throw new Error(resJson.error || "Failed to update property settings.");
      }

      setSuccess(`Property settings for "${settingName}" updated successfully.`);
      setShowSettingsModal(false);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to save property settings.");
    } finally {
      setSavingPropSettings(false);
    }
  }

  async function loadData() {
    setLoading(true);
    try {
      const [propRes, userRes] = await Promise.all([
        fetch("/api/properties"),
        fetch("/api/users"),
      ]);
      const propData = await propRes.json();
      const userData = await userRes.json();

      if (propData.success && propData.properties) {
        setProperties(propData.properties);
      }
      if (userData.success && userData.users) {
        setAllUsers(userData.users);
      }
    } catch {
      setError("Failed to load property locations.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const local = getClientUser();
    if (local) {
      setActiveUser(local);
      if (local.role) setCurrentUserRole(local.role);
    }

    fetchLatestSession()
      .then((data) => {
        if (data?.success && data?.user) {
          setActiveUser(data.user);
          if (data.user.role) setCurrentUserRole(data.user.role);
          try {
            localStorage.setItem("vistora-user", JSON.stringify(data.user));
          } catch {}
        }
      })
      .catch(() => {})
      .finally(() => {
        setSessionLoading(false);
      });

    loadData();
  }, []);

  async function handleCreateProperty(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setError(null);
    setSuccess(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim().toUpperCase(),
          location: location.trim(),
          country: country.trim(),
          brand: brand.trim(),
          totalRooms: parseInt(totalRooms, 10) || 100,
          userIds: selectedUserIds,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to create property.");
      }

      setSuccess(`Property "${data.property.name}" registered successfully.`);
      setShowAddModal(false);
      setName("");
      setCode("");
      setSelectedUserIds([]);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to register property.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteProperty(propertyId: string, propName: string) {
    if (!window.confirm(`Are you sure you want to remove "${propName}"? Associated stays and records will be unlinked.`)) {
      return;
    }

    try {
      const res = await fetch("/api/properties", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to delete property.");
      }
      setSuccess(`Property "${propName}" removed.`);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to delete property.");
    }
  }

  async function handleToggleActive(propertyId: string, currentActive: boolean) {
    try {
      const res = await fetch("/api/properties", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          isActive: !currentActive,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to toggle status");
      }
      setProperties((prev) =>
        prev.map((p) => (p.id === propertyId ? { ...p, is_active: !currentActive } : p))
      );
      setSuccess(`Property status set to ${!currentActive ? "Active" : "Disabled (Hidden from public forms)"}.`);
    } catch (err: any) {
      setError(err.message || "Failed to update property status.");
    }
  }

  function toggleUserSelection(userId: string) {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  }

  return (
    <AppShell active="Properties" user={activeUser}>
      <div className="content-wrap">
        {sessionLoading ? (
          <div className="panel" style={{ padding: "60px 24px", textAlign: "center" }}>
            <p className="eyebrow" style={{ color: "var(--muted)" }}>Portfolio Management</p>
            <h2 style={{ fontSize: "20px", margin: "10px 0" }}>Verifying access…</h2>
          </div>
        ) : !canManageProperties ? (
          <div className="panel" style={{ padding: "50px 24px", textAlign: "center", maxWidth: "600px", margin: "40px auto" }}>
            <p className="eyebrow" style={{ color: "var(--muted)" }}>Access & Administration</p>
            <h2 style={{ fontSize: "22px", margin: "10px 0" }}>Access Restricted</h2>
            <p style={{ color: "var(--muted)", fontSize: "13px", lineHeight: "1.6", marginBottom: "24px" }}>
              Your account does not have permission to manage hotel property locations.
            </p>
            <a className="button button-dark" href="/dashboard" style={{ display: "inline-flex" }}>
              ← Return to Dashboard
            </a>
          </div>
        ) : (
          <>
            <div className="page-heading">
              <div>
                <p className="eyebrow">Portfolio & Locations</p>
                <h1>Properties</h1>
                <p className="subheading">
                  Manage hotel properties, operational location codes, and assign staff member access.
                </p>
              </div>
              <button
                className="button button-dark compact"
                onClick={() => {
                  setError(null);
                  setSuccess(null);
                  setShowAddModal(true);
                }}
              >
                <Plus size={14} strokeWidth={2} style={{ marginRight: "6px" }} />
                New property
              </button>
            </div>

            {error && (
              <div className="panel" style={{ padding: "12px 18px", marginBottom: "16px", background: "var(--red-soft)", color: "var(--red)", border: "1px solid #ebd3cf", fontSize: "12px" }}>
                {error}
              </div>
            )}

            {success && (
              <div className="panel" style={{ padding: "12px 18px", marginBottom: "16px", background: "var(--sage-soft)", color: "var(--sage-deep)", border: "1px solid #d4e2d6", fontSize: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                <Check size={14} strokeWidth={2} />
                {success}
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px", marginBottom: "32px" }}>
              {loading ? (
                <div className="panel" style={{ padding: "32px", textAlign: "center", color: "var(--muted)", gridColumn: "1 / -1" }}>
                  Loading property locations…
                </div>
              ) : properties.length === 0 ? (
                <div className="panel" style={{ padding: "32px", textAlign: "center", color: "var(--muted)", gridColumn: "1 / -1" }}>
                  No properties registered yet. Click &ldquo;New property&rdquo; to add your first hotel location.
                </div>
              ) : (
                properties.map((prop) => {
                  const assignedCount = prop.profiles?.length || 0;
                  const isActive = prop.is_active !== false;
                  return (
                    <div
                      key={prop.id}
                      className="panel"
                      style={{
                        padding: "20px",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        gap: "16px",
                        opacity: isActive ? 1 : 0.82,
                        border: isActive ? undefined : "1px dashed rgba(185, 28, 28, 0.35)",
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                          <span
                            style={{
                              fontFamily: "var(--font-dm-mono)",
                              fontSize: "11px",
                              letterSpacing: "0.08em",
                              background: isActive ? "#0b100f" : "#475569",
                              color: "#fff",
                              padding: "2px 8px",
                              borderRadius: "3px",
                              fontWeight: 600,
                            }}
                          >
                            {prop.code}
                          </span>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <button
                              type="button"
                              onClick={() => handleToggleActive(prop.id, isActive)}
                              style={{
                                border: "1px solid",
                                borderColor: isActive ? "#bbf7d0" : "#fecaca",
                                cursor: "pointer",
                                padding: "2px 8px",
                                borderRadius: "6px",
                                fontSize: "10px",
                                fontFamily: "var(--font-dm-mono)",
                                letterSpacing: "0.04em",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "5px",
                                background: isActive ? "#f0fdf4" : "#fef2f2",
                                color: isActive ? "#15803d" : "var(--red)",
                                fontWeight: 600,
                                transition: "all 0.15s ease",
                              }}
                              title={
                                isActive
                                  ? "Property is active. Click to disable (hides from public feedback forms)."
                                  : "Property is disabled. Click to activate."
                              }
                            >
                              <span
                                style={{
                                  width: "6px",
                                  height: "6px",
                                  borderRadius: "50%",
                                  background: isActive ? "#22c55e" : "#ef4444",
                                }}
                              />
                              {isActive ? "ACTIVE" : "DISABLED"}
                            </button>
                            <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                              {prop.total_rooms} keys
                            </span>
                          </div>
                        </div>

                        <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--ink)", margin: "0 0 4px 0" }}>
                          {prop.name}
                        </h2>
                        <p style={{ fontSize: "12px", color: "var(--muted)", margin: "0 0 12px 0" }}>
                          {prop.location}, {prop.country} · {prop.brand}
                        </p>

                        {!isActive && (
                          <div
                            style={{
                              padding: "6px 10px",
                              background: "rgba(185, 28, 28, 0.08)",
                              border: "1px solid rgba(185, 28, 28, 0.2)",
                              borderRadius: "4px",
                              fontSize: "11px",
                              color: "var(--red)",
                              marginBottom: "10px",
                            }}
                          >
                            Offline / Disabled: Hidden from guest feedback selection
                          </div>
                        )}

                        <div style={{ borderTop: "1px solid #edf1ed", paddingTop: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                          <Users size={13} strokeWidth={1.75} style={{ color: "var(--muted)" }} />
                          <span style={{ fontSize: "11px", color: "var(--ink-light)" }}>
                            {assignedCount === 0 ? (
                              <em style={{ color: "var(--muted)" }}>Global access (All users)</em>
                            ) : (
                              <span><strong>{assignedCount}</strong> team member{assignedCount === 1 ? "" : "s"} assigned</span>
                            )}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #edf1ed", paddingTop: "12px", gap: "6px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <button
                            type="button"
                            onClick={() => handleOpenSettings(prop)}
                            className="button button-outline compact"
                            style={{ fontSize: "11px", padding: "4px 8px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                            title="Configure property-specific operational settings"
                          >
                            <Settings size={11} strokeWidth={1.75} />
                            Settings
                          </button>
                          <a
                            href={`/dashboard?property=${prop.id}`}
                            className="button button-outline compact"
                            style={{ fontSize: "11px", padding: "4px 10px" }}
                          >
                            View Ops ↗
                          </a>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteProperty(prop.id, prop.name)}
                          className="button button-outline compact"
                          style={{ fontSize: "11px", padding: "4px 8px", color: "var(--red)", borderColor: "#eddcd9" }}
                          title="Delete property"
                        >
                          <Trash2 size={12} strokeWidth={1.75} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>

      {/* CREATE PROPERTY MODAL */}
      <AnimatePresence>
        {showAddModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(11, 16, 15, 0.45)",
              backdropFilter: "blur(4px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
              padding: "16px",
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="workspace-modal"
              role="dialog"
              aria-modal="true"
              style={{
                background: "var(--panel)",
                border: "1px solid var(--line)",
                borderRadius: "8px",
                width: "100%",
                maxWidth: "520px",
                padding: "24px",
                boxShadow: "0 20px 40px rgba(0,0,0,0.12)",
                maxHeight: "90vh",
                overflowY: "auto",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <div>
                  <p className="eyebrow">Portfolio Registration</p>
                  <h2 style={{ fontSize: "18px", margin: 0 }}>Register new property</h2>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)" }}
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateProperty}>
                <div style={{ marginBottom: "14px" }}>
                  <label className="field-label" htmlFor="prop-name">
                    Property Name *
                  </label>
                  <input
                    id="prop-name"
                    type="text"
                    required
                    placeholder="e.g. Vistora Phuket Beach Resort"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (!code) {
                        const words = e.target.value.trim().split(/\s+/).filter(Boolean);
                        if (words.length >= 2) {
                          setCode(words.map((w) => w[0]).join("").slice(0, 3).toUpperCase());
                        }
                      }
                    }}
                    style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--line)", borderRadius: "4px", fontSize: "12px", outline: "none" }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
                  <div>
                    <label className="field-label" htmlFor="prop-code">
                      Property Code (3-4 letters) *
                    </label>
                    <input
                      id="prop-code"
                      type="text"
                      required
                      placeholder="e.g. VPB"
                      maxLength={4}
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--line)", borderRadius: "4px", fontSize: "12px", fontFamily: "var(--font-dm-mono)", outline: "none" }}
                    />
                  </div>
                  <div>
                    <label className="field-label" htmlFor="prop-rooms">
                      Total Keys / Rooms
                    </label>
                    <input
                      id="prop-rooms"
                      type="number"
                      value={totalRooms}
                      onChange={(e) => setTotalRooms(e.target.value)}
                      style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--line)", borderRadius: "4px", fontSize: "12px", outline: "none" }}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                  <div>
                    <label className="field-label" htmlFor="prop-location">
                      City / Location
                    </label>
                    <input
                      id="prop-location"
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--line)", borderRadius: "4px", fontSize: "12px", outline: "none" }}
                    />
                  </div>
                  <div>
                    <label className="field-label" htmlFor="prop-country">
                      Country
                    </label>
                    <input
                      id="prop-country"
                      type="text"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--line)", borderRadius: "4px", fontSize: "12px", outline: "none" }}
                    />
                  </div>
                </div>

                {/* USER ACCESS ASSIGNMENT */}
                <div style={{ marginBottom: "20px", borderTop: "1px solid #edf1ed", paddingTop: "14px" }}>
                  <label className="field-label" style={{ marginBottom: "6px" }}>
                    Give access to specific users:
                  </label>
                  <p style={{ fontSize: "11px", color: "var(--muted)", margin: "0 0 10px 0" }}>
                    Selected team members will be granted immediate operational access to this property.
                  </p>

                  <div style={{ maxHeight: "160px", overflowY: "auto", border: "1px solid var(--line)", borderRadius: "4px", padding: "6px" }}>
                    {allUsers.length === 0 ? (
                      <p style={{ fontSize: "11px", color: "var(--muted)", padding: "8px", margin: 0 }}>No team members available.</p>
                    ) : (
                      allUsers.map((u) => {
                        const isChecked = selectedUserIds.includes(u.id);
                        return (
                          <label
                            key={u.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              padding: "6px 8px",
                              borderRadius: "3px",
                              background: isChecked ? "#f4f7f4" : "transparent",
                              cursor: "pointer",
                              fontSize: "12px",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleUserSelection(u.id)}
                            />
                            <span style={{ fontWeight: 500, color: "var(--ink)" }}>{u.full_name}</span>
                            <span style={{ color: "var(--muted)", fontSize: "11px" }}>({u.email})</span>
                            <span
                              style={{
                                marginLeft: "auto",
                                fontSize: "9px",
                                textTransform: "uppercase",
                                fontFamily: "var(--font-dm-mono)",
                                color: "var(--muted)",
                              }}
                            >
                              {u.role}
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                  <button
                    type="button"
                    className="button button-outline"
                    onClick={() => setShowAddModal(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="button button-dark" disabled={submitting}>
                    {submitting ? "Creating…" : "Create property"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* PROPERTY SETTINGS MODAL */}
        {showSettingsModal && selectedSettingProperty && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(11, 16, 15, 0.45)",
              backdropFilter: "blur(4px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
              padding: "16px",
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="workspace-modal"
              role="dialog"
              aria-modal="true"
              style={{
                // Shared responsive dialog treatment also applies to property editing.
                background: "var(--panel, #ffffff)",
                border: "1px solid var(--line)",
                borderRadius: "8px",
                width: "100%",
                maxWidth: "600px",
                padding: "26px",
                boxShadow: "0 20px 48px rgba(0,0,0,0.18)",
                maxHeight: "90vh",
                overflowY: "auto",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <div>
                  <h3 style={{ margin: "0 0 4px 0", fontSize: "17px", color: "var(--ink)" }}>
                    Property Settings · {selectedSettingProperty.name}
                  </h3>
                  <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)" }}>
                    Configure hotel parameters, operational keys, contact routes, and public form visibility.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: "4px" }}
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSavePropertySettings}>
                {/* Active / Disabled Status Toggle Banner */}
                <div
                  style={{
                    padding: "14px 16px",
                    background: settingIsActive ? "var(--sage-soft, #f0fdf4)" : "var(--red-soft, #fef2f2)",
                    border: `1px solid ${settingIsActive ? "var(--sage, #bbf7d0)" : "var(--red, #fecaca)"}`,
                    borderRadius: "6px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "18px",
                  }}
                >
                  <div>
                    <strong style={{ display: "block", fontSize: "12px", color: settingIsActive ? "var(--sage-deep, #15803d)" : "var(--red, #b91c1c)" }}>
                      Operational Status: {settingIsActive ? "ACTIVE & LIVE" : "DISABLED / INACTIVE"}
                    </strong>
                    <p style={{ margin: "2px 0 0", fontSize: "11px", color: "var(--muted)" }}>
                      {settingIsActive
                        ? "Visible to guests on public feedback forms and touchpoints."
                        : "Hidden from guest feedback forms and QR codes."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSettingIsActive(!settingIsActive)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "4px",
                      border: "1px solid var(--line)",
                      background: "var(--panel, #ffffff)",
                      color: "var(--ink)",
                      fontWeight: 600,
                      fontSize: "11px",
                      cursor: "pointer",
                    }}
                  >
                    {settingIsActive ? "Set Inactive" : "Set Active"}
                  </button>
                </div>

                <div style={{ display: "grid", gap: "14px", marginBottom: "18px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "12px" }}>
                    <div>
                      <label className="field-label" style={{ display: "block", marginBottom: "4px", fontSize: "11px" }}>
                        Property Name *
                      </label>
                      <input
                        type="text"
                        className="auth-input"
                        value={settingName}
                        onChange={(e) => setSettingName(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="field-label" style={{ display: "block", marginBottom: "4px", fontSize: "11px" }}>
                        Code (e.g. VRB) *
                      </label>
                      <input
                        type="text"
                        className="auth-input"
                        value={settingCode}
                        onChange={(e) => setSettingCode(e.target.value)}
                        maxLength={5}
                        required
                      />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div>
                      <label className="field-label" style={{ display: "block", marginBottom: "4px", fontSize: "11px" }}>
                        Brand / Collection
                      </label>
                      <input
                        type="text"
                        className="auth-input"
                        value={settingBrand}
                        onChange={(e) => setSettingBrand(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="field-label" style={{ display: "block", marginBottom: "4px", fontSize: "11px" }}>
                        Total Rooms / Keys
                      </label>
                      <input
                        type="number"
                        min={1}
                        className="auth-input"
                        value={settingRooms}
                        onChange={(e) => setSettingRooms(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="field-label" style={{ display: "block", marginBottom: "4px", fontSize: "11px" }}>
                      Location &amp; Country
                    </label>
                    <input
                      type="text"
                      className="auth-input"
                      value={settingLocation}
                      onChange={(e) => setSettingLocation(e.target.value)}
                    />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div>
                      <label className="field-label" style={{ display: "block", marginBottom: "4px", fontSize: "11px" }}>
                        Concierge Alert Email
                      </label>
                      <input
                        type="email"
                        className="auth-input"
                        value={settingEmail}
                        onChange={(e) => setSettingEmail(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="field-label" style={{ display: "block", marginBottom: "4px", fontSize: "11px" }}>
                        Contact Phone
                      </label>
                      <input
                        type="text"
                        className="auth-input"
                        value={settingPhone}
                        onChange={(e) => setSettingPhone(e.target.value)}
                        placeholder="+66 2 123 4567"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="field-label" style={{ display: "block", marginBottom: "4px", fontSize: "11px" }}>
                      Guest Welcome Message (Shown on Public Feedback Form)
                    </label>
                    <textarea
                      rows={2}
                      className="auth-input"
                      value={settingWelcome}
                      onChange={(e) => setSettingWelcome(e.target.value)}
                      style={{ resize: "vertical" }}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", borderTop: "1px solid var(--line)", paddingTop: "16px" }}>
                  <button
                    type="button"
                    className="button button-outline"
                    onClick={() => setShowSettingsModal(false)}
                    disabled={savingPropSettings}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="button button-dark"
                    disabled={savingPropSettings}
                    style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    <Settings size={13} />
                    <span>{savingPropSettings ? "Saving…" : "Save Property Settings"}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AppShell>
  );
}
