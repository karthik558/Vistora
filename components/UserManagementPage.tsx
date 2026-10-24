"use client";

import { useEffect, useState } from "react";
import { AppShell, WorkspaceUser } from "./Dashboard";
import { UserPlus, Key, Trash2, X, Check, Building2, Shield, Settings2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export interface UserRight {
  id: string;
  name: string;
  description: string;
}

export const SYSTEM_RIGHTS: UserRight[] = [
  { id: "view_feedback", name: "View Guest Feedback", description: "Read reviews, ratings, and guest sentiment" },
  { id: "manage_complaints", name: "Complaints & Service Recovery", description: "Resolve escalations, assign duty staff & add recovery notes" },
  { id: "reassign_property", name: "Reassign Feedback Property", description: "Change hotel property assignment on feedback records" },
  { id: "manage_properties", name: "Manage Hotel Properties", description: "Create new hotel locations and assign staff access" },
  { id: "manage_questionnaire", name: "Manage Questionnaire", description: "Design custom feedback questions and survey options" },
  { id: "export_reports", name: "Export Operational Reports", description: "Download date-wise CSV, Excel and PDF executive audits" },
  { id: "manage_users", name: "Manage Team & Rights", description: "Invite new team members and assign permissions" },
];

export const ROLE_DEFAULT_RIGHTS: Record<string, string[]> = {
  admin: SYSTEM_RIGHTS.map((r) => r.id),
  staff: ["view_feedback", "manage_complaints", "manage_questionnaire", "export_reports"],
  visitor: ["view_feedback"],
};

interface WorkspaceUserItem {
  id: string;
  email: string;
  full_name: string;
  role: "admin" | "staff" | "visitor";
  property_id?: string | null;
  properties?: { id: string; name: string; code: string } | null;
  rights?: string[];
  created_at?: string;
}

interface PropertyOption {
  id: string;
  name: string;
  code: string;
  location: string;
}

export default function UserManagementPage({ initialUser }: { initialUser?: WorkspaceUser | null }) {
  const [users, setUsers] = useState<WorkspaceUserItem[]>([]);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // User session
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(initialUser?.role || null);
  const [sessionLoading, setSessionLoading] = useState(!initialUser?.role);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState<WorkspaceUserItem | null>(null);
  const [showPropertyModal, setShowPropertyModal] = useState(false);
  const [editAccessUser, setEditAccessUser] = useState<WorkspaceUserItem | null>(null);

  // Form states for Add User
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [addRole, setAddRole] = useState<"admin" | "staff" | "visitor">("staff");
  const [addPropertyId, setAddPropertyId] = useState("");
  const [addRights, setAddRights] = useState<string[]>(ROLE_DEFAULT_RIGHTS.staff);
  const [submitting, setSubmitting] = useState(false);

  // Form states for Change Password
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // Form states for Create Property
  const [newPropName, setNewPropName] = useState("");
  const [newPropCode, setNewPropCode] = useState("");
  const [newPropLocation, setNewPropLocation] = useState("Bangkok");
  const [newPropCountry, setNewPropCountry] = useState("Thailand");
  const [newPropRooms, setNewPropRooms] = useState("200");
  const [selectedUserIdsForProp, setSelectedUserIdsForProp] = useState<string[]>([]);
  const [creatingProp, setCreatingProp] = useState(false);

  // Form states for Edit Access
  const [editRole, setEditRole] = useState<"admin" | "staff" | "visitor">("staff");
  const [editPropertyId, setEditPropertyId] = useState("");
  const [editRights, setEditRights] = useState<string[]>([]);
  const [savingAccess, setSavingAccess] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const [usersRes, propRes] = await Promise.all([
        fetch("/api/users"),
        fetch("/api/properties"),
      ]);
      const usersData = await usersRes.json();
      const propData = await propRes.json();

      if (usersData.success && usersData.users) {
        setUsers(usersData.users);
      }
      if (propData.success && propData.properties) {
        setProperties(propData.properties);
      }
    } catch {
      setError("Failed to load workspace data.");
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

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: addName.trim(),
          email: addEmail.trim(),
          password: addPassword.trim(),
          role: addRole,
          propertyId: addPropertyId || null,
          rights: addRights,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to create user.");
      }

      setSuccess(`User ${data.user.full_name} added successfully with assigned rights.`);
      setShowAddModal(false);
      setAddName("");
      setAddEmail("");
      setAddPassword("");
      setAddRole("staff");
      setAddPropertyId("");
      setAddRights(ROLE_DEFAULT_RIGHTS.staff);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to create user.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!showPasswordModal) return;
    setError(null);
    setSuccess(null);
    setChangingPassword(true);

    try {
      const res = await fetch("/api/users/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: showPasswordModal.id,
          email: showPasswordModal.email,
          newPassword: newPassword.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update password.");
      }

      setSuccess(`Password updated successfully for ${showPasswordModal.email}.`);
      setShowPasswordModal(null);
      setNewPassword("");
    } catch (err: any) {
      setError(err.message || "Failed to change password.");
    } finally {
      setChangingPassword(false);
    }
  }

  async function handleCreatePropertyFromUsers(e: React.FormEvent) {
    e.preventDefault();
    if (!newPropName.trim()) return;

    setError(null);
    setSuccess(null);
    setCreatingProp(true);

    try {
      const res = await fetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newPropName.trim(),
          code: newPropCode.trim().toUpperCase(),
          location: newPropLocation.trim(),
          country: newPropCountry.trim(),
          totalRooms: parseInt(newPropRooms, 10) || 120,
          userIds: selectedUserIdsForProp,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to create property.");
      }

      setSuccess(`Property "${data.property.name}" registered and user access assigned.`);
      setShowPropertyModal(false);
      setNewPropName("");
      setNewPropCode("");
      setSelectedUserIdsForProp([]);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to create property.");
    } finally {
      setCreatingProp(false);
    }
  }

  async function handleUpdateAccess(e: React.FormEvent) {
    e.preventDefault();
    if (!editAccessUser) return;

    setError(null);
    setSuccess(null);
    setSavingAccess(true);

    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: editAccessUser.id,
          role: editRole,
          propertyId: editPropertyId || null,
          rights: editRights,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update access.");
      }

      setSuccess(`Access and rights updated for ${editAccessUser.full_name}.`);
      setEditAccessUser(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to update access.");
    } finally {
      setSavingAccess(false);
    }
  }

  async function handleDeleteUser(user: WorkspaceUserItem) {
    if (!window.confirm(`Are you sure you want to remove ${user.full_name} (${user.email})?`)) {
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to remove user.");
      }
      setSuccess(`User ${user.full_name} removed.`);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to remove user.");
    }
  }

  return (
    <AppShell active="Team & users">
      <div className="content-wrap">
        {sessionLoading ? (
          <div className="panel" style={{ padding: "60px 24px", textAlign: "center", maxWidth: "600px", margin: "40px auto" }}>
            <p className="eyebrow" style={{ color: "var(--muted)" }}>Access & Administration</p>
            <h2 style={{ fontSize: "20px", margin: "10px 0" }}>Verifying credentials…</h2>
            <p style={{ color: "var(--muted)", fontSize: "13px" }}>Loading workspace permissions…</p>
          </div>
        ) : currentUserRole === "visitor" ? (
          <div className="panel" style={{ padding: "50px 24px", textAlign: "center", maxWidth: "600px", margin: "40px auto" }}>
            <p className="eyebrow" style={{ color: "var(--muted)" }}>Access & Administration</p>
            <h2 style={{ fontSize: "22px", margin: "10px 0" }}>Access Restricted</h2>
            <p style={{ color: "var(--muted)", fontSize: "13px", lineHeight: "1.6", marginBottom: "24px" }}>
              Your account is assigned the <strong>Visitor</strong> role. Visitor users have view-only access across guest experience records and cannot access user administration or member settings.
            </p>
            <a className="button button-dark" href="/dashboard" style={{ display: "inline-flex" }}>
              ← Return to Dashboard
            </a>
          </div>
        ) : (
          <>
            <div className="page-heading">
              <div>
                <p className="eyebrow">Access & Administration</p>
                <h1>Team & users</h1>
                <p className="subheading">
                  Manage workspace members, property access assignments, and authentication credentials.
                </p>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  className="button button-outline compact"
                  onClick={() => {
                    setError(null);
                    setSuccess(null);
                    setShowPropertyModal(true);
                  }}
                >
                  <Building2 size={14} strokeWidth={1.75} style={{ marginRight: "6px" }} />
                  Create property
                </button>
                <button
                  className="button button-dark compact"
                  onClick={() => {
                    setError(null);
                    setSuccess(null);
                    setShowAddModal(true);
                  }}
                >
                  <UserPlus size={14} strokeWidth={1.75} style={{ marginRight: "6px" }} />
                  Add member
                </button>
              </div>
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

            <section className="panel table-panel">
              <div className="panel-heading">
                <div>
                  <h2>Workspace members</h2>
                  <p>Active accounts with operational and property-level access to Vistora</p>
                </div>
                <span className="panel-action">{users.length} members</span>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Member</th>
                      <th>Email ID</th>
                      <th>Assigned Role</th>
                      <th>Property Access</th>
                      <th>Created</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: "center", padding: "28px", color: "var(--muted)" }}>
                          Loading team members…
                        </td>
                      </tr>
                    ) : users.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: "center", padding: "28px", color: "var(--muted)" }}>
                          No members found. Click &ldquo;Add member&rdquo; above to invite a user.
                        </td>
                      </tr>
                    ) : (
                      users.map((user) => {
                        const initials = (user.full_name || user.email)
                          .split(" ")
                          .map((p) => p[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase();

                        return (
                          <tr key={user.id}>
                            <td>
                              <div className="guest-cell">
                                <span className="mini-avatar">{initials}</span>
                                <strong>{user.full_name}</strong>
                              </div>
                            </td>
                            <td>
                              <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: "11px", color: "var(--ink-light)" }}>
                                {user.email}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "flex-start" }}>
                                <span
                                  className="status"
                                  style={{
                                    background: user.role === "admin" ? "#254230" : "var(--line)",
                                    color: user.role === "admin" ? "#fff" : "var(--ink)",
                                    fontFamily: "var(--font-dm-mono)",
                                    fontSize: "9px",
                                    letterSpacing: "0.08em",
                                    textTransform: "uppercase",
                                    padding: "2px 7px",
                                  }}
                                >
                                  {user.role}
                                </span>
                                <span
                                  title={(user.rights || []).join(", ") || "Standard access"}
                                  style={{
                                    fontSize: "10px",
                                    color: "var(--muted)",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "3px",
                                  }}
                                >
                                  <Shield size={10} strokeWidth={1.75} />
                                  {user.rights?.length ? `${user.rights.length} rights active` : "Role default"}
                                </span>
                              </div>
                            </td>
                            <td>
                              {user.properties?.name ? (
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "5px",
                                    background: "#f0f4f0",
                                    color: "#1c3825",
                                    padding: "3px 8px",
                                    borderRadius: "3px",
                                    fontSize: "11px",
                                    fontWeight: 500,
                                  }}
                                >
                                  <Building2 size={11} strokeWidth={1.75} />
                                  {user.properties.name} ({user.properties.code})
                                </span>
                              ) : (
                                <span style={{ color: "var(--muted)", fontSize: "11px" }}>
                                  All Properties (Global)
                                </span>
                              )}
                            </td>
                            <td>
                              <span style={{ color: "var(--muted)", fontSize: "11px" }}>
                                {user.created_at ? new Date(user.created_at).toLocaleDateString() : "Active"}
                              </span>
                            </td>
                            <td style={{ textAlign: "right" }}>
                              <div style={{ display: "inline-flex", gap: "6px" }}>
                                <button
                                  type="button"
                                  className="button button-outline compact"
                                  style={{ padding: "4px 8px", fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                                  onClick={() => {
                                    setEditAccessUser(user);
                                    setEditRole(user.role);
                                    setEditPropertyId(user.property_id || "");
                                    setEditRights(
                                      user.rights && user.rights.length > 0
                                        ? user.rights
                                        : ROLE_DEFAULT_RIGHTS[user.role] || []
                                    );
                                    setError(null);
                                    setSuccess(null);
                                  }}
                                  title="Edit role, rights and property access"
                                >
                                  <Settings2 size={12} strokeWidth={1.75} />
                                  Access & Rights
                                </button>
                                <button
                                  type="button"
                                  className="button button-outline compact"
                                  style={{ padding: "4px 8px", fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                                  onClick={() => {
                                    setShowPasswordModal(user);
                                    setNewPassword("");
                                    setError(null);
                                    setSuccess(null);
                                  }}
                                  title="Change password"
                                >
                                  <Key size={12} strokeWidth={1.75} />
                                  Password
                                </button>
                                <button
                                  type="button"
                                  className="button compact"
                                  style={{ padding: "4px 8px", fontSize: "11px", background: "transparent", color: "var(--muted)", border: "1px solid var(--line)" }}
                                  onClick={() => handleDeleteUser(user)}
                                  title="Remove user"
                                >
                                  <Trash2 size={12} strokeWidth={1.75} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* MODAL: ADD MEMBER */}
            <AnimatePresence>
              {showAddModal && (
                <motion.div
                  key="add-member-backdrop"
                  className="drawer-backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  onClick={() => setShowAddModal(false)}
                >
                  <motion.div
                    key="add-member-drawer"
                    className="detail-drawer"
                    style={{ maxWidth: "420px" }}
                    initial={{ x: "100%", opacity: 0.85 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: "100%", opacity: 0.85 }}
                    transition={{ type: "spring", damping: 30, stiffness: 300, mass: 0.8 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button className="drawer-close" onClick={() => setShowAddModal(false)} aria-label="Close">
                      <X size={18} strokeWidth={1.75} />
                    </button>
                    <p className="eyebrow">Workspace Administration</p>
                    <h2>Add team member</h2>
                    <p className="drawer-meta">Create an operational account with role and property assignment.</p>

                    <form onSubmit={handleAddUser} style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
                      <label className="field-label">
                        Full Name
                        <input
                          className="auth-input"
                          value={addName}
                          onChange={(e) => setAddName(e.target.value)}
                          placeholder="e.g. Somchai Tan"
                          required
                        />
                      </label>

                      <label className="field-label">
                        Work Email
                        <input
                          className="auth-input"
                          type="email"
                          value={addEmail}
                          onChange={(e) => setAddEmail(e.target.value)}
                          placeholder="e.g. member@hotel.com"
                          required
                        />
                      </label>

                      <label className="field-label">
                        Role Assignment
                        <select
                          className="auth-input"
                          value={addRole}
                          onChange={(e) => {
                            const newRole = e.target.value as any;
                            setAddRole(newRole);
                            setAddRights(ROLE_DEFAULT_RIGHTS[newRole] || []);
                          }}
                        >
                          <option value="visitor">Visitor (Standard User - View-only)</option>
                          <option value="staff">Staff (Operations Lead)</option>
                          <option value="admin">Admin (Workspace Admin)</option>
                        </select>
                      </label>

                      <label className="field-label">
                        Property Access
                        <select
                          className="auth-input"
                          value={addPropertyId}
                          onChange={(e) => setAddPropertyId(e.target.value)}
                        >
                          <option value="">All Properties (Global Access)</option>
                          {properties.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.code})
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="field-label">
                        Initial Password
                        <input
                          className="auth-input"
                          type="password"
                          value={addPassword}
                          onChange={(e) => setAddPassword(e.target.value)}
                          placeholder="Minimum 6 characters"
                          required
                          minLength={6}
                        />
                      </label>

                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                          <span className="field-label" style={{ margin: 0 }}>
                            Assigned Rights & Capabilities ({addRights.length} active)
                          </span>
                          <div style={{ display: "flex", gap: "6px" }}>
                            <button
                              type="button"
                              className="button button-outline compact"
                              style={{ padding: "2px 7px", fontSize: "10px" }}
                              onClick={() => setAddRights(SYSTEM_RIGHTS.map((r) => r.id))}
                            >
                              All
                            </button>
                            <button
                              type="button"
                              className="button button-outline compact"
                              style={{ padding: "2px 7px", fontSize: "10px" }}
                              onClick={() => setAddRights([])}
                            >
                              Clear
                            </button>
                          </div>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px",
                            maxHeight: "180px",
                            overflowY: "auto",
                            border: "1px solid var(--line)",
                            borderRadius: "6px",
                            padding: "10px 12px",
                            background: "#fafbfa",
                          }}
                        >
                          {SYSTEM_RIGHTS.map((right) => {
                            const checked = addRights.includes(right.id);
                            return (
                              <label
                                key={right.id}
                                style={{
                                  display: "flex",
                                  alignItems: "flex-start",
                                  gap: "10px",
                                  fontSize: "12px",
                                  cursor: "pointer",
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setAddRights([...addRights, right.id]);
                                    } else {
                                      setAddRights(addRights.filter((id) => id !== right.id));
                                    }
                                  }}
                                  style={{ marginTop: "2px", accentColor: "#0b100f" }}
                                />
                                <div>
                                  <div style={{ fontWeight: 600, color: "var(--ink)", fontSize: "12px" }}>
                                    {right.name}
                                  </div>
                                  <div style={{ fontSize: "11px", color: "var(--muted)", lineHeight: 1.3 }}>
                                    {right.description}
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="button button-dark"
                        disabled={submitting}
                        style={{ marginTop: "12px", padding: "12px" }}
                      >
                        {submitting ? "Creating member…" : "Save and Grant Access →"}
                      </button>
                    </form>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* MODAL: EDIT ACCESS */}
            <AnimatePresence>
              {editAccessUser && (
                <motion.div
                  key="edit-access-backdrop"
                  className="drawer-backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setEditAccessUser(null)}
                >
                  <motion.div
                    key="edit-access-drawer"
                    className="detail-drawer"
                    style={{ maxWidth: "420px" }}
                    initial={{ x: "100%", opacity: 0.85 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: "100%", opacity: 0.85 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button className="drawer-close" onClick={() => setEditAccessUser(null)} aria-label="Close">
                      <X size={18} strokeWidth={1.75} />
                    </button>
                    <p className="eyebrow">Permissions & Assignment</p>
                    <h2>Edit member access</h2>
                    <p className="drawer-meta">Updating settings for <strong>{editAccessUser.full_name}</strong> ({editAccessUser.email})</p>

                    <form onSubmit={handleUpdateAccess} style={{ marginTop: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
                      <label className="field-label">
                        Role
                        <select
                          className="auth-input"
                          value={editRole}
                          onChange={(e) => {
                            const newRole = e.target.value as any;
                            setEditRole(newRole);
                          }}
                        >
                          <option value="visitor">Visitor (View-only)</option>
                          <option value="staff">Staff (Operations Lead)</option>
                          <option value="admin">Admin (Full Access)</option>
                        </select>
                      </label>

                      <label className="field-label">
                        Assigned Property
                        <select
                          className="auth-input"
                          value={editPropertyId}
                          onChange={(e) => setEditPropertyId(e.target.value)}
                        >
                          <option value="">All Properties (Global Access)</option>
                          {properties.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.code})
                            </option>
                          ))}
                        </select>
                      </label>

                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                          <span className="field-label" style={{ margin: 0 }}>
                            Assigned Rights & Capabilities ({editRights.length} active)
                          </span>
                          <div style={{ display: "flex", gap: "6px" }}>
                            <button
                              type="button"
                              className="button button-outline compact"
                              style={{ padding: "2px 7px", fontSize: "10px" }}
                              onClick={() => setEditRights(SYSTEM_RIGHTS.map((r) => r.id))}
                            >
                              All
                            </button>
                            <button
                              type="button"
                              className="button button-outline compact"
                              style={{ padding: "2px 7px", fontSize: "10px" }}
                              onClick={() => setEditRights([])}
                            >
                              Clear
                            </button>
                          </div>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px",
                            maxHeight: "180px",
                            overflowY: "auto",
                            border: "1px solid var(--line)",
                            borderRadius: "6px",
                            padding: "10px 12px",
                            background: "#fafbfa",
                          }}
                        >
                          {SYSTEM_RIGHTS.map((right) => {
                            const checked = editRights.includes(right.id);
                            return (
                              <label
                                key={right.id}
                                style={{
                                  display: "flex",
                                  alignItems: "flex-start",
                                  gap: "10px",
                                  fontSize: "12px",
                                  cursor: "pointer",
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setEditRights([...editRights, right.id]);
                                    } else {
                                      setEditRights(editRights.filter((id) => id !== right.id));
                                    }
                                  }}
                                  style={{ marginTop: "2px", accentColor: "#0b100f" }}
                                />
                                <div>
                                  <div style={{ fontWeight: 600, color: "var(--ink)", fontSize: "12px" }}>
                                    {right.name}
                                  </div>
                                  <div style={{ fontSize: "11px", color: "var(--muted)", lineHeight: 1.3 }}>
                                    {right.description}
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="button button-dark"
                        disabled={savingAccess}
                        style={{ padding: "12px" }}
                      >
                        {savingAccess ? "Saving changes…" : "Save Permissions →"}
                      </button>
                    </form>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* MODAL: CREATE PROPERTY (Directly in User Section) */}
            <AnimatePresence>
              {showPropertyModal && (
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
                        <h2 style={{ fontSize: "18px", margin: 0 }}>Create property & assign users</h2>
                      </div>
                      <button
                        onClick={() => setShowPropertyModal(false)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)" }}
                      >
                        <X size={18} />
                      </button>
                    </div>

                    <form onSubmit={handleCreatePropertyFromUsers}>
                      <div style={{ marginBottom: "14px" }}>
                        <label className="field-label">
                          Property Name *
                        </label>
                        <input
                          className="auth-input"
                          required
                          placeholder="e.g. Vistora Phuket Beach Resort"
                          value={newPropName}
                          onChange={(e) => {
                            setNewPropName(e.target.value);
                            if (!newPropCode) {
                              const words = e.target.value.trim().split(/\s+/).filter(Boolean);
                              if (words.length >= 2) {
                                setNewPropCode(words.map((w) => w[0]).join("").slice(0, 3).toUpperCase());
                              }
                            }
                          }}
                        />
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
                        <div>
                          <label className="field-label">
                            Code (3-4 letters) *
                          </label>
                          <input
                            className="auth-input"
                            required
                            placeholder="e.g. VPB"
                            maxLength={4}
                            value={newPropCode}
                            onChange={(e) => setNewPropCode(e.target.value.toUpperCase())}
                            style={{ fontFamily: "var(--font-dm-mono)" }}
                          />
                        </div>
                        <div>
                          <label className="field-label">
                            Total Rooms
                          </label>
                          <input
                            className="auth-input"
                            type="number"
                            value={newPropRooms}
                            onChange={(e) => setNewPropRooms(e.target.value)}
                          />
                        </div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                        <div>
                          <label className="field-label">
                            City / Location
                          </label>
                          <input
                            className="auth-input"
                            value={newPropLocation}
                            onChange={(e) => setNewPropLocation(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="field-label">
                            Country
                          </label>
                          <input
                            className="auth-input"
                            value={newPropCountry}
                            onChange={(e) => setNewPropCountry(e.target.value)}
                          />
                        </div>
                      </div>

                      {/* User access selection */}
                      <div style={{ marginBottom: "20px", borderTop: "1px solid #edf1ed", paddingTop: "14px" }}>
                        <label className="field-label" style={{ marginBottom: "6px" }}>
                          Give access to specific users:
                        </label>
                        <p style={{ fontSize: "11px", color: "var(--muted)", margin: "0 0 10px 0" }}>
                          Check the workspace members who should have access to this new property:
                        </p>
                        <div style={{ maxHeight: "150px", overflowY: "auto", border: "1px solid var(--line)", borderRadius: "4px", padding: "6px" }}>
                          {users.map((u) => {
                            const isChecked = selectedUserIdsForProp.includes(u.id);
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
                                  onChange={() => {
                                    setSelectedUserIdsForProp((prev) =>
                                      prev.includes(u.id) ? prev.filter((id) => id !== u.id) : [...prev, u.id]
                                    );
                                  }}
                                />
                                <span style={{ fontWeight: 500, color: "var(--ink)" }}>{u.full_name}</span>
                                <span style={{ color: "var(--muted)", fontSize: "11px" }}>({u.email})</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                        <button
                          type="button"
                          className="button button-outline"
                          onClick={() => setShowPropertyModal(false)}
                          disabled={creatingProp}
                        >
                          Cancel
                        </button>
                        <button type="submit" className="button button-dark" disabled={creatingProp}>
                          {creatingProp ? "Creating…" : "Create & Assign Users"}
                        </button>
                      </div>
                    </form>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* MODAL: CHANGE PASSWORD */}
            <AnimatePresence>
              {showPasswordModal && (
                <motion.div
                  key="change-password-backdrop"
                  className="drawer-backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  onClick={() => setShowPasswordModal(null)}
                >
                  <motion.div
                    key="change-password-drawer"
                    className="detail-drawer"
                    style={{ maxWidth: "420px" }}
                    initial={{ x: "100%", opacity: 0.85 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: "100%", opacity: 0.85 }}
                    transition={{ type: "spring", damping: 30, stiffness: 300, mass: 0.8 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button className="drawer-close" onClick={() => setShowPasswordModal(null)} aria-label="Close">
                      <X size={18} strokeWidth={1.75} />
                    </button>
                    <p className="eyebrow">Security & Credentials</p>
                    <h2>Change password</h2>
                    <p className="drawer-meta">Updating password for <strong>{showPasswordModal.email}</strong></p>

                    <form onSubmit={handleChangePassword} style={{ marginTop: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
                      <label className="field-label">
                        New Password
                        <input
                          className="auth-input"
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Enter new password (min. 6 characters)"
                          required
                          minLength={6}
                          autoFocus
                        />
                      </label>

                      <button
                        type="submit"
                        className="button button-dark"
                        disabled={changingPassword}
                        style={{ padding: "12px" }}
                      >
                        {changingPassword ? "Updating password…" : "Update Password →"}
                      </button>
                    </form>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    </AppShell>
  );
}
