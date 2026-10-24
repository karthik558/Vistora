"use client";

import { useEffect, useState } from "react";
import { AppShell } from "./Dashboard";
import { UserPlus, Key, Trash2, X, Check } from "lucide-react";

interface WorkspaceUserItem {
  id: string;
  email: string;
  full_name: string;
  role: "admin" | "staff" | "visitor";
  created_at?: string;
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<WorkspaceUserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState<WorkspaceUserItem | null>(null);

  // Form states for Add User
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [addRole, setAddRole] = useState<"admin" | "staff" | "visitor">("staff");
  const [submitting, setSubmitting] = useState(false);

  // Form states for Change Password
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  async function loadUsers() {
    setLoading(true);
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      if (data.success && data.users) {
        setUsers(data.users);
      }
    } catch {
      setError("Failed to load workspace members.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
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
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to create user.");
      }

      setSuccess(`User ${data.user.full_name} added successfully.`);
      setShowAddModal(false);
      setAddName("");
      setAddEmail("");
      setAddPassword("");
      setAddRole("staff");
      await loadUsers();
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

      setSuccess(`Password for ${showPasswordModal.email} updated successfully.`);
      setShowPasswordModal(null);
      setNewPassword("");
    } catch (err: any) {
      setError(err.message || "Failed to update password.");
    } finally {
      setChangingPassword(false);
    }
  }

  async function handleDeleteUser(user: WorkspaceUserItem) {
    if (!confirm(`Are you sure you want to remove ${user.full_name || user.email} from the workspace?`)) {
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

      setSuccess(`User ${user.email} removed.`);
      await loadUsers();
    } catch (err: any) {
      setError(err.message || "Failed to remove user.");
    }
  }

  return (
    <AppShell active="Team & users">
      <div className="content-wrap">
        <div className="page-heading">
          <div>
            <p className="eyebrow">Access & Administration</p>
            <h1>Team & users</h1>
            <p className="subheading">
              Manage workspace members, role assignments, and authentication credentials.
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
            <UserPlus size={14} strokeWidth={1.75} style={{ marginRight: "6px" }} />
            Add member
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

        <section className="panel table-panel">
          <div className="panel-heading">
            <div>
              <h2>Workspace members</h2>
              <p>Active accounts with operational access to Vistora</p>
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
                  <th>Created</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: "28px", color: "var(--muted)" }}>
                      Loading team members…
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: "28px", color: "var(--muted)" }}>
                      No members found. Click "Add member" above to invite a user.
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
                        </td>
                        <td>
                          <span style={{ color: "var(--muted)", fontSize: "11px" }}>
                            {user.created_at ? new Date(user.created_at).toLocaleDateString() : "Active"}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: "8px" }}>
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

        {/* Modal: Add Member */}
        {showAddModal && (
          <div className="drawer-backdrop" onClick={() => setShowAddModal(false)}>
            <div className="detail-drawer" style={{ maxWidth: "420px" }} onClick={(e) => e.stopPropagation()}>
              <button className="drawer-close" onClick={() => setShowAddModal(false)} aria-label="Close">
                <X size={18} strokeWidth={1.75} />
              </button>
              <p className="eyebrow">Workspace Administration</p>
              <h2>Add team member</h2>
              <p className="drawer-meta">Create an operational account with role-based permissions.</p>

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
                    onChange={(e) => setAddRole(e.target.value as any)}
                  >
                    <option value="staff">Staff (Operations Lead)</option>
                    <option value="admin">Admin (General Manager)</option>
                    <option value="visitor">Visitor (Read-only Preview)</option>
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

                <button
                  type="submit"
                  className="button button-dark"
                  disabled={submitting}
                  style={{ marginTop: "12px", padding: "12px" }}
                >
                  {submitting ? "Creating member…" : "Save and Grant Access →"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Change Password */}
        {showPasswordModal && (
          <div className="drawer-backdrop" onClick={() => setShowPasswordModal(null)}>
            <div className="detail-drawer" style={{ maxWidth: "420px" }} onClick={(e) => e.stopPropagation()}>
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
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
