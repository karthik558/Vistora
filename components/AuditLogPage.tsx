"use client";

import { useEffect, useState, useMemo } from "react";
import {
  ShieldCheck,
  Search,
  Filter,
  Download,
  Clock,
  User,
  AlertTriangle,
  CheckCircle,
  FileText,
  Activity,
  Calendar,
} from "lucide-react";
import { AppShell, WorkspaceUser, getClientUser, fetchLatestSession } from "./Dashboard";
import { AuditLogItem } from "../lib/services/auditLogService";

export default function AuditLogPage({ initialUser }: { initialUser?: WorkspaceUser | null }) {
  const [user, setUser] = useState<WorkspaceUser | null>(
    () => initialUser || (typeof window !== "undefined" ? getClientUser() : null)
  );
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  useEffect(() => {
    const local = getClientUser();
    if (local && !user) setUser(local);

    fetchLatestSession()
      .then((data) => {
        if (data?.success && data?.user) setUser(data.user);
      })
      .catch(() => {});

    loadLogs();
  }, []);

  async function loadLogs() {
    setLoading(true);
    try {
      const res = await fetch("/api/audit-log");
      const json = await res.json();
      if (json.success && json.logs) {
        setLogs(json.logs);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (statusFilter !== "all" && log.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          log.actorName.toLowerCase().includes(q) ||
          log.actorEmail.toLowerCase().includes(q) ||
          log.action.toLowerCase().includes(q) ||
          log.resource.toLowerCase().includes(q) ||
          (log.details && log.details.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [logs, search, statusFilter]);

  function exportAuditCsv() {
    const headers = ["Timestamp", "Actor Name", "Actor Email", "Role", "Action", "Resource", "Details", "IP", "Status"];
    const rows = filteredLogs.map((l) => [
      l.timestamp,
      l.actorName,
      l.actorEmail,
      l.actorRole,
      l.action,
      l.resource,
      l.details || "",
      l.ip || "",
      l.status,
    ]);

    const csv = [
      headers.map((h) => `"${h}"`).join(","),
      ...rows.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")),
    ].join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `vistora-audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell active="Audit log" user={user}>
      <div className="content-wrap">
        <div className="page-heading">
          <div>
            <p className="eyebrow">Governance &amp; Accountability</p>
            <h1>Workspace audit log</h1>
            <p className="subheading">
              Chronological security record of team operations, SLA resolutions, privilege modifications, and system events.
            </p>
          </div>
          <div className="page-heading-actions">
            <button
              type="button"
              className="button button-outline"
              onClick={exportAuditCsv}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <Download size={14} />
              <span>Export Audit CSV</span>
            </button>
          </div>
        </div>

        {/* Metric Summary */}
        <section className="metric-grid">
          <div className="metric-card">
            <span className="metric-label">Logged Events</span>
            <div className="metric-value">{logs.length}</div>
            <div className="metric-change">Recorded workspace operations</div>
          </div>
          <div className="metric-card">
            <span className="metric-label">Operational Changes</span>
            <div className="metric-value">
              {logs.filter((l) => l.action.includes("Modified") || l.action.includes("Updated")).length}
            </div>
            <div className="metric-change">Settings &amp; user permission updates</div>
          </div>
          <div className="metric-card">
            <span className="metric-label">SLA Actions</span>
            <div className="metric-value">
              {logs.filter((l) => l.action.includes("SLA") || l.action.includes("Complaint")).length}
            </div>
            <div className="metric-change">Service recovery interventions</div>
          </div>
          <div className="metric-card">
            <span className="metric-label">Integrity Status</span>
            <div className="metric-value" style={{ color: "var(--sage)" }}>Verified</div>
            <div className="metric-change">All events securely hashed &amp; logged</div>
          </div>
        </section>

        {/* Search & Filter Bar */}
        <div className="panel" style={{ padding: "16px 20px", marginBottom: "20px" }}>
          <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", justifyContent: "space-between" }}>
            <div style={{ position: "relative", minWidth: "260px", flex: 1 }}>
              <Search
                size={15}
                style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }}
              />
              <input
                type="text"
                className="auth-input"
                placeholder="Search audit trail by actor, action, or affected resource…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: "32px", height: "36px", fontSize: "12px" }}
              />
            </div>

            <div style={{ display: "flex", border: "1px solid var(--line)", borderRadius: "6px", overflow: "hidden" }}>
              {(["all", "success", "warning", "alert"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  style={{
                    padding: "8px 14px",
                    fontSize: "11px",
                    fontWeight: 600,
                    background: statusFilter === s ? "var(--ink)" : "var(--panel)",
                    color: statusFilter === s ? "#fff" : "var(--muted)",
                    border: "none",
                    cursor: "pointer",
                    textTransform: "capitalize",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="panel" style={{ overflow: "hidden" }}>
          <div className="table-shell">
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Team Member &amp; Role</th>
                  <th>Action</th>
                  <th>Target Resource</th>
                  <th>Details</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "48px 16px", color: "var(--muted)" }}>
                      {loading ? "Loading audit logs…" : "No audit records found matching your filters."}
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} style={{ cursor: "pointer" }} onClick={() => setSelectedLog(log)}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <Clock size={12} style={{ color: "var(--muted)" }} />
                          <span style={{ fontSize: "11px", fontFamily: "var(--font-dm-mono)" }}>
                            {new Date(log.timestamp).toLocaleString([], {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div>
                          <strong style={{ fontSize: "12px" }}>{log.actorName}</strong>
                          <span
                            style={{
                              display: "block",
                              fontSize: "10px",
                              color: "var(--muted)",
                              fontFamily: "var(--font-dm-mono)",
                              textTransform: "uppercase",
                            }}
                          >
                            {log.actorRole.replace("_", " ")}
                          </span>
                        </div>
                      </td>
                      <td>
                        <strong style={{ fontSize: "12px", color: "var(--ink)" }}>{log.action}</strong>
                      </td>
                      <td>
                        <span style={{ fontSize: "12px", color: "var(--muted)" }}>{log.resource}</span>
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: "11px",
                            color: "var(--muted)",
                            display: "inline-block",
                            maxWidth: "280px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {log.details || "—"}
                        </span>
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: "10px",
                            padding: "2px 8px",
                            borderRadius: "4px",
                            fontWeight: 600,
                            fontFamily: "var(--font-dm-mono)",
                            textTransform: "uppercase",
                            background:
                              log.status === "alert"
                                ? "var(--red-soft)"
                                : log.status === "warning"
                                ? "var(--amber-soft)"
                                : "var(--sage-soft)",
                            color:
                              log.status === "alert"
                                ? "var(--red)"
                                : log.status === "warning"
                                ? "var(--amber)"
                                : "var(--sage-deep)",
                          }}
                        >
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Audit Details Modal */}
        {selectedLog && (
          <div
            className="drawer-backdrop"
            style={{ display: "grid", placeItems: "center" }}
            onClick={() => setSelectedLog(null)}
          >
            <div
              style={{
                background: "var(--panel)",
                borderRadius: "12px",
                padding: "32px",
                maxWidth: "520px",
                width: "90%",
                boxShadow: "var(--shadow-lg)",
                border: "1px solid var(--line)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="eyebrow">Audit Entry Detail</p>
              <h3 style={{ margin: "6px 0 16px" }}>{selectedLog.action}</h3>
              <div style={{ display: "grid", gap: "12px", fontSize: "12px", marginBottom: "22px" }}>
                <div>
                  <span style={{ color: "var(--muted)" }}>Actor: </span>
                  <strong>{selectedLog.actorName}</strong> ({selectedLog.actorEmail}) — <em>{selectedLog.actorRole}</em>
                </div>
                <div>
                  <span style={{ color: "var(--muted)" }}>Timestamp: </span>
                  <code>{new Date(selectedLog.timestamp).toISOString()}</code>
                </div>
                <div>
                  <span style={{ color: "var(--muted)" }}>Resource: </span>
                  <strong>{selectedLog.resource}</strong>
                </div>
                <div>
                  <span style={{ color: "var(--muted)" }}>IP / Device: </span>
                  <code>{selectedLog.ip || "127.0.0.1"}</code>
                </div>
                <div>
                  <span style={{ color: "var(--muted)" }}>Details: </span>
                  <div style={{ marginTop: "4px", padding: "10px", background: "var(--canvas-alt)", borderRadius: "6px" }}>
                    {selectedLog.details || "No additional parameters logged."}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="button button-dark"
                onClick={() => setSelectedLog(null)}
                style={{ width: "100%" }}
              >
                Close Audit Inspection
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
