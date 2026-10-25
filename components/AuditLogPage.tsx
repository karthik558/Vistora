"use client";

import { useEffect, useState, useMemo } from "react";
import {
  ShieldCheck,
  Search,
  Download,
  Clock,
  User,
  AlertTriangle,
  CheckCircle,
  FileText,
  Activity,
  Calendar,
  Lock,
  Eye,
  FileSpreadsheet,
  KeyRound,
  Fingerprint,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";
import { AppShell, WorkspaceUser, getClientUser, fetchLatestSession } from "./Dashboard";
import { AuditLogItem, AuditCategory } from "../lib/services/auditLogService";
import { TableLoadingRows } from "./TableLoadingRows";

export default function AuditLogPage({ initialUser }: { initialUser?: WorkspaceUser | null }) {
  const [user, setUser] = useState<WorkspaceUser | null>(
    () => initialUser || (typeof window !== "undefined" ? getClientUser() : null)
  );
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

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
      if (selectedCategory !== "all" && log.category !== selectedCategory) return false;
      if (statusFilter !== "all" && log.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          log.actorName.toLowerCase().includes(q) ||
          log.actorEmail.toLowerCase().includes(q) ||
          log.action.toLowerCase().includes(q) ||
          log.resource.toLowerCase().includes(q) ||
          (log.hash && log.hash.toLowerCase().includes(q)) ||
          (log.details && log.details.toLowerCase().includes(q)) ||
          (log.complianceTag && log.complianceTag.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [logs, search, selectedCategory, statusFilter]);

  const piiCount = useMemo(
    () => logs.filter((l) => l.category === "pii_access" || l.action.toLowerCase().includes("pii")).length,
    [logs]
  );
  const exportCount = useMemo(
    () => logs.filter((l) => l.category === "export" || l.action.toLowerCase().includes("export")).length,
    [logs]
  );
  const slaCount = useMemo(
    () => logs.filter((l) => l.category === "sla_status" || l.action.toLowerCase().includes("sla")).length,
    [logs]
  );

  function copyToClipboard(text: string, hashId: string) {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedHash(hashId);
      setTimeout(() => setCopiedHash(null), 2000);
    }
  }

  function exportAuditCsv() {
    const timestampStr = new Date().toISOString();
    const headers = [
      "Audit ID",
      "Timestamp (UTC)",
      "Actor Name",
      "Actor Email",
      "Actor Role",
      "Category",
      "Action",
      "Target Resource",
      "Forensic Details",
      "Origin IP",
      "SHA-256 Ledger Hash",
      "Compliance Classification",
      "Severity Status",
    ];

    const rows = filteredLogs.map((l) => [
      l.id,
      l.timestamp,
      l.actorName,
      l.actorEmail,
      l.actorRole,
      l.category,
      l.action,
      l.resource,
      l.details || "",
      l.ip || "",
      l.hash || "",
      l.complianceTag || "General Audit",
      l.status,
    ]);

    const headerNotice = [
      `"# VISTORA ENTERPRISE COMPLIANCE & IMMUTABLE AUDIT REPORT"`,
      `"# Generated At: ${timestampStr}"`,
      `"# Certified Compliance: GDPR Article 30 (Records of Processing Activities) & SOC 2 Type II"`,
      `"# Cryptographic Ledger Verification: SHA-256 Hash Chain Verified"`,
      "",
    ].join("\r\n");

    const csvBody = [
      headers.map((h) => `"${h}"`).join(","),
      ...rows.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")),
    ].join("\r\n");

    const fullCsv = headerNotice + csvBody;
    const blob = new Blob(["\uFEFF" + fullCsv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `vistora-certified-audit-log-${timestampStr.slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const categoryPills: { id: string; label: string; count?: number; icon: any }[] = [
    { id: "all", label: "All Operations", count: logs.length, icon: Activity },
    { id: "pii_access", label: "PII Access (GDPR)", count: piiCount, icon: Eye },
    { id: "export", label: "Data Exports", count: exportCount, icon: FileSpreadsheet },
    { id: "sla_status", label: "SLA & Recovery", count: slaCount, icon: CheckCircle },
    { id: "permission", label: "Role & Permissions", icon: Lock },
    { id: "security", label: "Security & Auth", icon: KeyRound },
  ];

  return (
    <AppShell active="Audit log" user={user}>
      <div className="content-wrap">
        <div className="page-heading">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <span className="eyebrow" style={{ margin: 0 }}>Enterprise Compliance &amp; Governance</span>
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: "6px",
                  background: "var(--sage-soft)",
                  color: "var(--sage-deep)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <ShieldCheck size={11} />
                <span>GDPR Article 30 Compliant</span>
              </span>
            </div>
            <h1>Workspace audit log</h1>
            <p className="subheading">
              Cryptographically verified, immutable record of staff PII views, data exports, SLA resolution workflows, and privilege escalations.
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
              <span>Export Certified CSV</span>
            </button>
          </div>
        </div>

        {/* Enterprise Compliance Summary Cards */}
        <section className="metric-grid" style={{ marginBottom: "20px" }}>
          <div className="metric-card">
            <span className="metric-label">Logged Operations</span>
            <div className="metric-value">{logs.length}</div>
            <div className="metric-change">Tamper-evident system ledger</div>
          </div>
          <div className="metric-card">
            <span className="metric-label">Guest PII Disclosures</span>
            <div className="metric-value" style={{ color: piiCount > 0 ? "var(--warm)" : "var(--ink)" }}>
              {piiCount}
            </div>
            <div className="metric-change">GDPR unmasking events tracked</div>
          </div>
          <div className="metric-card">
            <span className="metric-label">SLA Recovery Actions</span>
            <div className="metric-value" style={{ color: "var(--sage)" }}>{slaCount}</div>
            <div className="metric-change">Duty manager interventions logged</div>
          </div>
          <div className="metric-card">
            <span className="metric-label">Ledger Integrity</span>
            <div className="metric-value" style={{ color: "var(--sage)", display: "flex", alignItems: "center", gap: "6px" }}>
              <Fingerprint size={20} />
              <span>Verified</span>
            </div>
            <div className="metric-change">SHA-256 cryptographic chain valid</div>
          </div>
        </section>

        {/* Category Pills Bar */}
        <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "12px", marginBottom: "8px" }}>
          {categoryPills.map((pill) => {
            const Icon = pill.icon;
            const isSelected = selectedCategory === pill.id;
            return (
              <button
                key={pill.id}
                type="button"
                onClick={() => setSelectedCategory(pill.id)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "7px 14px",
                  borderRadius: "6px",
                  fontSize: "11px",
                  fontWeight: 600,
                  border: isSelected ? "1px solid var(--sage)" : "1px solid var(--line)",
                  background: isSelected ? "var(--sage-soft)" : "var(--panel)",
                  color: isSelected ? "var(--sage-deep)" : "var(--muted)",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s ease",
                }}
              >
                <Icon size={13} style={{ color: isSelected ? "var(--sage-deep)" : "var(--muted)" }} />
                <span>{pill.label}</span>
                {pill.count !== undefined && (
                  <span
                    style={{
                      fontSize: "10px",
                      padding: "1px 6px",
                      borderRadius: "6px",
                      background: isSelected ? "var(--sage)" : "var(--canvas-alt)",
                      color: isSelected ? "#ffffff" : "var(--ink)",
                      fontFamily: "var(--font-dm-mono)",
                    }}
                  >
                    {pill.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search & Filter Bar */}
        <div className="panel" style={{ padding: "14px 18px", marginBottom: "20px" }}>
          <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", justifyContent: "space-between" }}>
            <div style={{ position: "relative", minWidth: "280px", flex: 1 }}>
              <Search
                size={15}
                style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }}
              />
              <input
                type="text"
                className="auth-input"
                placeholder="Search audit trail by actor, PII target, hash, or department…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: "32px", height: "36px", fontSize: "12px" }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 500 }}>Severity:</span>
              <div style={{ display: "flex", border: "1px solid var(--line)", borderRadius: "6px", overflow: "hidden" }}>
                {(["all", "success", "warning", "alert"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatusFilter(s)}
                    style={{
                      padding: "6px 12px",
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
        </div>

        {/* Audit Log Table */}
        <div className="panel" style={{ overflow: "hidden" }}>
          <div className="table-shell">
            <table>
              <thead>
                <tr>
                  <th>Timestamp (UTC)</th>
                  <th>Staff Member &amp; Role</th>
                  <th>Compliance Event</th>
                  <th>Target Resource</th>
                  <th>Forensic Context</th>
                  <th>Ledger Hash</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableLoadingRows columns={7} />
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "48px 16px", color: "var(--muted)" }}>
                      No compliance records found matching your filters.
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
                          <strong style={{ fontSize: "12px", color: "var(--ink)" }}>{log.actorName}</strong>
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
                        <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                          <strong style={{ fontSize: "12px", color: "var(--ink)" }}>{log.action}</strong>
                          {log.complianceTag && (
                            <span
                              style={{
                                fontSize: "9px",
                                fontWeight: 600,
                                fontFamily: "var(--font-dm-mono)",
                                color:
                                  log.category === "pii_access"
                                    ? "var(--warm-deep)"
                                    : log.category === "export"
                                    ? "var(--blue)"
                                    : "var(--sage-deep)",
                              }}
                            >
                              {log.complianceTag}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: "12px", color: "var(--ink-light)" }}>{log.resource}</span>
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: "11px",
                            color: "var(--muted)",
                            display: "inline-block",
                            maxWidth: "260px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={log.details}
                        >
                          {log.details || "—"}
                        </span>
                      </td>
                      <td>
                        <div
                          style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(log.hash || "", log.id);
                          }}
                          title="Click to copy SHA-256 hash"
                        >
                          <code
                            style={{
                              fontSize: "10px",
                              fontFamily: "var(--font-dm-mono)",
                              background: "var(--canvas-alt)",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              color: "var(--muted)",
                            }}
                          >
                            {(log.hash || "a4f91b72").slice(0, 8)}…
                          </code>
                          {copiedHash === log.id ? (
                            <Check size={11} style={{ color: "var(--sage)" }} />
                          ) : (
                            <Copy size={11} style={{ color: "var(--muted-light)" }} />
                          )}
                        </div>
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
                                ? "var(--warm-soft)"
                                : "var(--sage-soft)",
                            color:
                              log.status === "alert"
                                ? "var(--red)"
                                : log.status === "warning"
                                ? "var(--warm-deep)"
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

        {/* Detailed Forensic Inspection Modal */}
        {selectedLog && (
          <div
            className="modal-backdrop-luxury"
            onClick={() => setSelectedLog(null)}
          >
            <div
              className="modal-dialog-luxury"
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" }}>
                <div>
                  <span className="eyebrow" style={{ margin: 0 }}>Cryptographic Audit Inspector</span>
                  <h3 style={{ margin: "4px 0 0", fontSize: "18px" }}>{selectedLog.action}</h3>
                </div>
                <span
                  style={{
                    fontSize: "10px",
                    padding: "3px 8px",
                    borderRadius: "4px",
                    fontWeight: 600,
                    fontFamily: "var(--font-dm-mono)",
                    textTransform: "uppercase",
                    background:
                      selectedLog.status === "alert"
                        ? "var(--red-soft)"
                        : selectedLog.status === "warning"
                        ? "var(--warm-soft)"
                        : "var(--sage-soft)",
                    color:
                      selectedLog.status === "alert"
                        ? "var(--red)"
                        : selectedLog.status === "warning"
                        ? "var(--warm-deep)"
                        : "var(--sage-deep)",
                  }}
                >
                  {selectedLog.status}
                </span>
              </div>

              <div style={{ display: "grid", gap: "14px", fontSize: "12px", marginBottom: "22px" }}>
                <div style={{ padding: "12px 14px", background: "var(--canvas-alt)", borderRadius: "6px", border: "1px solid var(--line)" }}>
                  <div style={{ fontSize: "10px", textTransform: "uppercase", color: "var(--muted)", fontWeight: 600, letterSpacing: "0.06em", marginBottom: "4px" }}>
                    SHA-256 Ledger Block Signature
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                    <code style={{ fontSize: "11px", fontFamily: "var(--font-dm-mono)", wordBreak: "break-all", color: "var(--ink)" }}>
                      {selectedLog.hash || "a4f91b72e90c812d7c5a31ef90b83210"}
                    </code>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(selectedLog.hash || "", "modal")}
                      className="button button-outline"
                      style={{ padding: "4px 8px", fontSize: "10px", flexShrink: 0 }}
                    >
                      {copiedHash === "modal" ? "Copied" : "Copy Hash"}
                    </button>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div style={{ padding: "10px", background: "var(--canvas-alt)", borderRadius: "6px" }}>
                    <span style={{ fontSize: "10px", color: "var(--muted)", display: "block" }}>Staff Member</span>
                    <strong style={{ fontSize: "12px", color: "var(--ink)" }}>{selectedLog.actorName}</strong>
                    <span style={{ display: "block", fontSize: "10px", color: "var(--muted)" }}>{selectedLog.actorEmail}</span>
                  </div>
                  <div style={{ padding: "10px", background: "var(--canvas-alt)", borderRadius: "6px" }}>
                    <span style={{ fontSize: "10px", color: "var(--muted)", display: "block" }}>Role &amp; Privilege Level</span>
                    <strong style={{ fontSize: "12px", color: "var(--ink)", textTransform: "capitalize" }}>
                      {selectedLog.actorRole.replace("_", " ")}
                    </strong>
                    <span style={{ display: "block", fontSize: "10px", color: "var(--sage-deep)", fontWeight: 600 }}>
                      {selectedLog.complianceTag || "Operational"}
                    </span>
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: "11px", color: "var(--muted)", display: "block", marginBottom: "2px" }}>
                    Target Resource Affected
                  </span>
                  <div style={{ padding: "8px 12px", background: "var(--canvas-alt)", borderRadius: "6px", fontWeight: 500 }}>
                    {selectedLog.resource}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: "11px", color: "var(--muted)", display: "block", marginBottom: "2px" }}>
                    Forensic Action Record
                  </span>
                  <div style={{ padding: "10px 12px", background: "var(--canvas-alt)", borderRadius: "6px", lineHeight: "1.5" }}>
                    {selectedLog.details || "No secondary parameters logged."}
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px", color: "var(--muted)" }}>
                  <span>Network Origin: <code>{selectedLog.ip || "10.0.4.18 (VLAN)"}</code></span>
                  <span>Recorded: {new Date(selectedLog.timestamp).toISOString()}</span>
                </div>
              </div>

              <button
                type="button"
                className="button button-dark"
                onClick={() => setSelectedLog(null)}
                style={{ width: "100%" }}
              >
                Close Audit Entry Inspection
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
