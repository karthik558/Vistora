"use client";

import { useEffect, useState } from "react";
import { AppShell, WorkspaceUser } from "./Dashboard";
import { Building2, Plus, Trash2, X, Check, Users } from "lucide-react";
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
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(initialUser?.role || null);
  const [sessionLoading, setSessionLoading] = useState(!initialUser?.role);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
    try {
      const saved = localStorage.getItem("vistora-user");
      if (saved) {
        const u = JSON.parse(saved);
        if (u?.role) setCurrentUserRole(u.role);
      }
    } catch {}

    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => {
        if (data?.success && data?.user?.role) {
          setCurrentUserRole(data.user.role);
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

  function toggleUserSelection(userId: string) {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  }

  return (
    <AppShell active="Properties">
      <div className="content-wrap">
        {sessionLoading ? (
          <div className="panel" style={{ padding: "60px 24px", textAlign: "center" }}>
            <p className="eyebrow" style={{ color: "var(--muted)" }}>Portfolio Management</p>
            <h2 style={{ fontSize: "20px", margin: "10px 0" }}>Verifying access…</h2>
          </div>
        ) : currentUserRole === "visitor" ? (
          <div className="panel" style={{ padding: "50px 24px", textAlign: "center", maxWidth: "600px", margin: "40px auto" }}>
            <p className="eyebrow" style={{ color: "var(--muted)" }}>Access & Administration</p>
            <h2 style={{ fontSize: "22px", margin: "10px 0" }}>Access Restricted</h2>
            <p style={{ color: "var(--muted)", fontSize: "13px", lineHeight: "1.6", marginBottom: "24px" }}>
              Your account is assigned the <strong>Visitor</strong> role. Only workspace administrators have authorization to register or manage property locations.
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
              <div className="panel" style={{ padding: "12px 18px", marginBottom: "16px", background: "#fbf1ef", color: "#8b261a", border: "1px solid #ebd3cf", fontSize: "12px" }}>
                {error}
              </div>
            )}

            {success && (
              <div className="panel" style={{ padding: "12px 18px", marginBottom: "16px", background: "#edf4ed", color: "#254230", border: "1px solid #d4e2d6", fontSize: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
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
                  return (
                    <div key={prop.id} className="panel" style={{ padding: "20px", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "16px" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                          <span
                            style={{
                              fontFamily: "var(--font-dm-mono)",
                              fontSize: "11px",
                              letterSpacing: "0.08em",
                              background: "#0b100f",
                              color: "#fff",
                              padding: "2px 8px",
                              borderRadius: "3px",
                              fontWeight: 600,
                            }}
                          >
                            {prop.code}
                          </span>
                          <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                            {prop.total_rooms} keys
                          </span>
                        </div>
                        <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--ink)", margin: "0 0 4px 0" }}>
                          {prop.name}
                        </h2>
                        <p style={{ fontSize: "12px", color: "var(--muted)", margin: "0 0 12px 0" }}>
                          {prop.location}, {prop.country} · {prop.brand}
                        </p>

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

                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #edf1ed", paddingTop: "12px" }}>
                        <a
                          href={`/dashboard?property=${prop.id}`}
                          className="button button-outline compact"
                          style={{ fontSize: "11px", padding: "4px 10px" }}
                        >
                          View Operations ↗
                        </a>
                        <button
                          type="button"
                          onClick={() => handleDeleteProperty(prop.id, prop.name)}
                          className="button button-outline compact"
                          style={{ fontSize: "11px", padding: "4px 8px", color: "#8b261a", borderColor: "#eddcd9" }}
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
              style={{
                background: "#ffffff",
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
      </AnimatePresence>
    </AppShell>
  );
}
