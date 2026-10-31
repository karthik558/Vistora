"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { AppShell, WorkspaceUser } from "./Dashboard";
import DashboardPageHeading from "./DashboardPageHeading";
import WorkspaceSelect from "./WorkspaceSelect";
import { csvCell } from "../lib/platform/reports";
import {
  FileSpreadsheet,
  Printer,
  RefreshCw,
  Mail,
  PhoneCall,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Users,
  Building2,
  TrendingUp,
  Download,
  Filter,
  Check,
  Search,
  X,
  Layers,
  ArrowRight
} from "lucide-react";

interface ReportsModuleProps {
  user: WorkspaceUser | null;
}

const departments = [
  "All Departments",
  "Front Desk",
  "Housekeeping",
  "Food & Beverage",
  "Concierge",
  "Facilities & Room",
  "Spa & Wellness",
  "Valet & Transfers",
];

const date = (v: any) => {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString();
};

const dateOnly = (v: any) => {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "—" : d.toISOString().split("T")[0];
};

const val = (v: any) => (v === null || v === undefined ? "—" : v);

export default function ReportsModule({ user }: ReportsModuleProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"overview" | "emails" | "voice" | "sla" | "operations" | "builder">("overview");

  // Filters
  const [property, setProperty] = useState("all");
  const [days, setDays] = useState(30);
  const [datePreset, setDatePreset] = useState("30");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [selectedDept, setSelectedDept] = useState("All Departments");
  const [searchQuery, setSearchQuery] = useState("");

  // PDF Preview Modal
  const [showPdfModal, setShowPdfModal] = useState(false);
  const pdfRef = useRef<HTMLDivElement>(null);

  // Load report data
  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const url = `/api/reports/workspace?days=${days}&property=${encodeURIComponent(property)}`;
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || `Failed to fetch report data (${res.status})`);
      if (json) setData(json);
    } catch (err: any) {
      setError(err?.message || "Failed to load report data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [days, property]);

  // Handle Preset changes
  const handlePresetChange = (preset: string) => {
    setDatePreset(preset);
    if (preset === "custom") {
      // Keep existing custom dates
    } else {
      const d = Number(preset) || 30;
      setDays(d);
      const end = new Date();
      const start = new Date(Date.now() - d * 86400000);
      setCustomStart(start.toISOString().split("T")[0]);
      setCustomEnd(end.toISOString().split("T")[0]);
    }
  };

  // Helper to extract email recipient from payload if available
  const getRecipient = (item: any) => {
    if (item.payload?.recipient_email) return item.payload.recipient_email;
    if (item.payload?.guest_email) return item.payload.guest_email;
    if (item.payload?.email) return item.payload.email;
    if (item.payload?.to) return item.payload.to;
    return item.dedup_key?.split(":")[1] || "Guest / Staff";
  };

  const getSubject = (item: any) => {
    if (item.payload?.subject) return item.payload.subject;
    if (item.kind === "sla") return "Target SLA Escalation Alert";
    if (item.kind === "followup") return "Service Recovery Check-in";
    if (item.kind === "invitation") return "Guest Feedback Invitation";
    if (item.kind === "team_invitation") return "Workspace Team Invitation";
    if (item.kind === "report") return "Automated Management Report";
    return item.kind || "Notification";
  };

  // Export to Excel / CSV Engine
  const exportToExcel = (category: string) => {
    if (!data) return;

    let filename = `Vistora-Report-${category}-${dateOnly(new Date())}.csv`;
    let rows: (string | number)[][] = [];

    if (category === "executive" || category === "overview") {
      rows.push(["VISTORA LUXURY HOSPITALITY - EXECUTIVE INTELLIGENCE REPORT"]);
      rows.push(["Generated At", new Date().toLocaleString()]);
      rows.push(["Organization", data.organization?.name || "Vistora Workspace"]);
      rows.push(["Period", `Last ${days} days`]);
      rows.push(["Property Filter", property === "all" ? "All properties" : data.properties?.find((p: any) => p.id === property)?.name || property]);
      rows.push([]);
      rows.push(["Key Metric", "Current Period", "Previous Period"]);
      rows.push(["Total Guest Responses", val(data.report?.current?.responses), val(data.report?.previous?.responses)]);
      rows.push(["Average Rating (/ 5)", val(data.report?.current?.averageRating), val(data.report?.previous?.averageRating)]);
      rows.push(["Net Promoter Score (NPS)", val(data.report?.current?.nps), val(data.report?.previous?.nps)]);
      rows.push(["Open Cases", val(data.report?.current?.open), "—"]);
      rows.push(["Overdue Cases", val(data.report?.current?.overdue), "—"]);
      rows.push(["Mean Response (Minutes)", val(data.report?.current?.meanResponseMinutes), "—"]);
      rows.push(["Mean Resolution (Minutes)", val(data.report?.current?.meanResolutionMinutes), val(data.report?.previous?.meanResolutionMinutes)]);
      rows.push([]);
      rows.push(["PROPERTY BENCHMARKS"]);
      rows.push(["Property", "Responses", "Average Rating", "NPS", "Open Cases", "Overdue"]);
      (data.report?.properties || []).forEach((p: any) => {
        const propName = data.properties?.find((x: any) => x.id === p.name)?.name || p.name;
        rows.push([propName, p.responses, val(p.averageRating), val(p.nps), p.open, p.overdue]);
      });
      rows.push([]);
      rows.push(["DEPARTMENT PERFORMANCE"]);
      rows.push(["Department / Category", "Responses", "Average Rating", "NPS", "Open Cases"]);
      (data.report?.categories || []).forEach((c: any) => {
        rows.push([c.name, c.responses, val(c.averageRating), val(c.nps), c.open]);
      });
    } else if (category === "emails") {
      rows.push(["VISTORA EMAIL & COMMUNICATIONS AUDIT REPORT"]);
      rows.push(["Generated At", new Date().toLocaleString()]);
      rows.push([]);
      rows.push(["OUTBOUND EMAILS SENT"]);
      rows.push(["ID", "Category / Kind", "Recipient", "Subject", "Status", "Attempts", "Last Error", "Date & Time"]);
      (data.emailsSent || []).forEach((e: any) => {
        rows.push([
          e.id,
          e.kind,
          getRecipient(e),
          getSubject(e),
          e.status,
          e.attempts,
          e.last_error || "None",
          date(e.created_at)
        ]);
      });
      rows.push([]);
      rows.push(["INBOUND GUEST EMAILS & CONTACT REQUESTS"]);
      rows.push(["ID", "Guest Name", "Guest Email", "Guest Phone", "Room", "Department", "Rating", "Status", "Wants Contact", "Date & Time"]);
      (data.emailsReceived || []).forEach((g: any) => {
        rows.push([
          g.id,
          g.guest_name,
          g.guest_email || "Not provided",
          g.guest_phone || "Not provided",
          g.room_number,
          g.department,
          g.rating,
          g.status,
          g.wants_contact ? "Yes" : "No",
          date(g.created_at)
        ]);
      });
    } else if (category === "voice") {
      rows.push(["VISTORA VOICE & TELEPHONY EVENT REPORT"]);
      rows.push(["Generated At", new Date().toLocaleString()]);
      rows.push([]);
      rows.push(["ID", "Kind", "Destination / Room", "Duration (Seconds)", "Status", "Notes", "Scheduled At", "Created At"]);
      (data.voiceLogs || []).forEach((v: any) => {
        rows.push([
          v.id,
          v.kind,
          v.destination || "Direct Room",
          v.duration_seconds || 0,
          v.status,
          v.notes || "None",
          v.scheduled_at ? date(v.scheduled_at) : "—",
          date(v.created_at)
        ]);
      });
    } else if (category === "everything") {
      rows.push(["VISTORA COMPREHENSIVE MASTER OPERATIONAL AUDIT"]);
      rows.push(["Generated At", new Date().toLocaleString()]);
      rows.push(["Organization", data.organization?.name || "Vistora Workspace"]);
      rows.push(["Period", `Last ${days} days`]);
      rows.push([]);
      rows.push(["EXECUTIVE METRICS"]);
      rows.push(["Total Guest Responses", val(data.report?.current?.responses)]);
      rows.push(["Average Rating", val(data.report?.current?.averageRating)]);
      rows.push(["Net Promoter Score", val(data.report?.current?.nps)]);
      rows.push(["Total Outbound Emails", data.emailsSent?.length || 0]);
      rows.push(["Total Inbound Guest Emails", data.emailsReceived?.length || 0]);
      rows.push(["Total Voice Events", data.voiceLogs?.length || 0]);
      rows.push(["Total Service Jobs", data.serviceJobs?.length || 0]);
      rows.push([]);
      rows.push(["GUEST FEEDBACK SUMMARY"]);
      rows.push(["Guest Name", "Room", "Department", "Rating", "Email", "Status", "Date"]);
      (data.emailsReceived || []).forEach((f: any) => {
        rows.push([f.guest_name, f.room_number, f.department, f.rating, f.guest_email || "—", f.status, date(f.created_at)]);
      });
      rows.push([]);
      rows.push(["OUTBOUND NOTIFICATIONS"]);
      rows.push(["Type", "Recipient", "Status", "Attempts", "Date"]);
      (data.emailsSent || []).forEach((e: any) => {
        rows.push([e.kind, getRecipient(e), e.status, e.attempts, date(e.created_at)]);
      });
      rows.push([]);
      rows.push(["VOICE & TELEPHONY"]);
      rows.push(["Type", "Destination", "Status", "Duration", "Date"]);
      (data.voiceLogs || []).forEach((v: any) => {
        rows.push([v.kind, v.destination || "Room", v.status, `${v.duration_seconds || 0}s`, date(v.created_at)]);
      });
    } else {
      // General feedback & SLA
      rows.push(["VISTORA SLA & GUEST COMPLAINTS AUDIT REPORT"]);
      rows.push(["Generated At", new Date().toLocaleString()]);
      rows.push([]);
      rows.push(["Metric", "Value"]);
      rows.push(["Open Cases", val(data.report?.current?.open)]);
      rows.push(["Overdue Cases", val(data.report?.current?.overdue)]);
      rows.push(["Mean Response Minutes", val(data.report?.current?.meanResponseMinutes)]);
      rows.push(["Mean Resolution Minutes", val(data.report?.current?.meanResolutionMinutes)]);
      rows.push([]);
      rows.push(["DEPARTMENT WORKLOAD"]);
      rows.push(["Department / Owner", "Responses", "Average Rating", "NPS", "Open Cases", "Overdue"]);
      (data.report?.workload || []).forEach((w: any) => {
        rows.push([w.name, w.responses, val(w.averageRating), val(w.nps), w.open, w.overdue]);
      });
    }

    // Convert to CSV with BOM for universal Excel recognition
    const csvContent = "\uFEFF" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // PDF Print Trigger
  const handlePrint = () => {
    window.print();
  };

  // Filtered dataset for Emails
  const filteredEmailsSent = (data?.emailsSent || []).filter((e: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      e.kind?.toLowerCase().includes(q) ||
      e.status?.toLowerCase().includes(q) ||
      getRecipient(e).toLowerCase().includes(q)
    );
  });

  const filteredEmailsReceived = (data?.emailsReceived || []).filter((g: any) => {
    if (selectedDept !== "All Departments" && g.department !== selectedDept) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      g.guest_name?.toLowerCase().includes(q) ||
      g.guest_email?.toLowerCase().includes(q) ||
      g.room_number?.toLowerCase().includes(q)
    );
  });

  // Filtered dataset for Voice
  const filteredVoice = (data?.voiceLogs || []).filter((v: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      v.kind?.toLowerCase().includes(q) ||
      v.destination?.toLowerCase().includes(q) ||
      v.notes?.toLowerCase().includes(q) ||
      v.status?.toLowerCase().includes(q)
    );
  });

  return (
    <AppShell active="Reports" user={user}>
      <div className="content-wrap platform-page">
        {/* Module Header */}
        <DashboardPageHeading
          eyebrow="Intelligence & Export Engine"
          title="Reports & Analytics"
          description="Generate executive performance audits, email delivery tracking, voice communications, and export custom reports to Excel and PDF."
        >
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            <button
              type="button"
              className="button button-ghost compact"
              onClick={loadData}
              disabled={loading}
              aria-label="Refresh report data"
            >
              <RefreshCw size={15} className={loading ? "spin-icon" : ""} />
              {loading ? "Refreshing…" : "Refresh"}
            </button>
            <button
              type="button"
              className="button button-ghost compact"
              onClick={() => exportToExcel(tab === "overview" ? "executive" : tab)}
              disabled={loading || !data}
              title="Download spreadsheet formatted for Excel"
            >
              <FileSpreadsheet size={15} />
              Export Excel
            </button>
            <button
              type="button"
              className="button button-dark compact"
              onClick={() => setShowPdfModal(true)}
              disabled={loading || !data}
              title="Generate printable executive PDF document"
            >
              <Printer size={15} />
              Generate PDF
            </button>
          </div>
        </DashboardPageHeading>

        {/* Global Filter Bar */}
        <section className="platform-toolbar" style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "flex-end" }}>
          <label style={{ flex: "1 1 200px" }}>
            Property
            <WorkspaceSelect
              label="Filter by property"
              value={property}
              onChange={setProperty}
              options={[
                { value: "all", label: "All properties" },
                ...(data?.properties || []).map((p: any) => ({ value: p.id, label: p.name }))
              ]}
            />
          </label>

          <label style={{ flex: "1 1 180px" }}>
            Date range
            <WorkspaceSelect
              label="Report period"
              value={datePreset}
              onChange={handlePresetChange}
              options={[
                { value: "7", label: "Last 7 days" },
                { value: "30", label: "Last 30 days" },
                { value: "90", label: "Last 90 days" },
                { value: "365", label: "Year to date (365d)" },
                { value: "custom", label: "Custom date range" },
              ]}
            />
          </label>

          {datePreset === "custom" && (
            <>
              <label style={{ flex: "1 1 140px" }}>
                Start date
                <input
                  type="date"
                  className="compact-input"
                  value={customStart}
                  onChange={(e) => {
                    setCustomStart(e.target.value);
                    if (e.target.value && customEnd) {
                      const diff = Math.max(1, Math.round((Date.parse(customEnd) - Date.parse(e.target.value)) / 86400000));
                      setDays(diff);
                    }
                  }}
                  style={{ height: "36px", padding: "0 10px", borderRadius: "6px", border: "1px solid var(--line)" }}
                />
              </label>
              <label style={{ flex: "1 1 140px" }}>
                End date
                <input
                  type="date"
                  className="compact-input"
                  value={customEnd}
                  onChange={(e) => {
                    setCustomEnd(e.target.value);
                    if (customStart && e.target.value) {
                      const diff = Math.max(1, Math.round((Date.parse(e.target.value) - Date.parse(customStart)) / 86400000));
                      setDays(diff);
                    }
                  }}
                  style={{ height: "36px", padding: "0 10px", borderRadius: "6px", border: "1px solid var(--line)" }}
                />
              </label>
            </>
          )}

          <label style={{ flex: "1 1 180px" }}>
            Department
            <WorkspaceSelect
              label="Filter by department"
              value={selectedDept}
              onChange={setSelectedDept}
              options={departments.map((d) => ({ value: d, label: d }))}
            />
          </label>

          <div style={{ flex: "2 1 220px", display: "flex", gap: "8px", alignItems: "center" }}>
            <div style={{ position: "relative", width: "100%" }}>
              <Search size={15} style={{ position: "absolute", left: "10px", top: "10px", color: "var(--muted)" }} />
              <input
                type="text"
                placeholder="Search by name, room, email…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  height: "36px",
                  padding: "0 10px 0 32px",
                  borderRadius: "6px",
                  border: "1px solid var(--line)",
                  fontSize: "13px"
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  style={{ position: "absolute", right: "8px", top: "9px", background: "none", border: "none", cursor: "pointer", color: "var(--muted)" }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Section Navigation Tabs */}
        <nav className="platform-tabs" aria-label="Reports views">
          <button
            type="button"
            aria-current={tab === "overview" ? "page" : undefined}
            onClick={() => setTab("overview")}
          >
            <TrendingUp size={15} style={{ display: "inline-block", marginRight: "6px", verticalAlign: "middle" }} />
            Executive Summary
          </button>
          <button
            type="button"
            aria-current={tab === "emails" ? "page" : undefined}
            onClick={() => setTab("emails")}
          >
            <Mail size={15} style={{ display: "inline-block", marginRight: "6px", verticalAlign: "middle" }} />
            Emails Sent &amp; Received ({data?.emailsSent?.length || 0} / {data?.emailsReceived?.length || 0})
          </button>
          <button
            type="button"
            aria-current={tab === "voice" ? "page" : undefined}
            onClick={() => setTab("voice")}
          >
            <PhoneCall size={15} style={{ display: "inline-block", marginRight: "6px", verticalAlign: "middle" }} />
            Voice &amp; Telephony ({data?.voiceLogs?.length || 0})
          </button>
          <button
            type="button"
            aria-current={tab === "sla" ? "page" : undefined}
            onClick={() => setTab("sla")}
          >
            <Clock size={15} style={{ display: "inline-block", marginRight: "6px", verticalAlign: "middle" }} />
            SLA &amp; Complaints
          </button>
          <button
            type="button"
            aria-current={tab === "operations" ? "page" : undefined}
            onClick={() => setTab("operations")}
          >
            <Layers size={15} style={{ display: "inline-block", marginRight: "6px", verticalAlign: "middle" }} />
            Operational Audit
          </button>
          <button
            type="button"
            aria-current={tab === "builder" ? "page" : undefined}
            onClick={() => setTab("builder")}
          >
            <Download size={15} style={{ display: "inline-block", marginRight: "6px", verticalAlign: "middle" }} />
            Custom Report Builder
          </button>
        </nav>

        {/* Status Alerts */}
        {error && <div className="platform-notice" role="alert">{error}</div>}
        {loading && !data && <p role="status" style={{ padding: "30px 0", textAlign: "center", color: "var(--muted)" }}>Loading report metrics and logs…</p>}

        {data && (
          <>
            {/* TAB 1: EXECUTIVE SUMMARY */}
            {tab === "overview" && data.report && (
              <>
                {/* Executive KPI Stats */}
                <div className="platform-stats" style={{ marginBottom: "20px" }}>
                  <article className="platform-stat">
                    <span>Guest Responses</span>
                    <strong>{val(data.report.current?.responses)}</strong>
                    <small>Previous: {val(data.report.previous?.responses)}</small>
                  </article>
                  <article className="platform-stat">
                    <span>Average Satisfaction</span>
                    <strong>{val(data.report.current?.averageRating)} <span style={{ fontSize: "14px", fontWeight: "normal", color: "var(--muted)" }}>/ 5</span></strong>
                    <small>Previous: {val(data.report.previous?.averageRating)}</small>
                  </article>
                  <article className="platform-stat">
                    <span>Net Promoter Score</span>
                    <strong>{val(data.report.current?.nps)}</strong>
                    <small>{data.report.current?.promoters || 0} promoters · {data.report.current?.detractors || 0} detractors</small>
                  </article>
                  <article className="platform-stat">
                    <span>Open Service Cases</span>
                    <strong>{val(data.report.current?.open)}</strong>
                    <small>{data.report.current?.overdue || 0} overdue</small>
                  </article>
                  <article className="platform-stat">
                    <span>Outbound Emails</span>
                    <strong>{data.emailsSent?.length || 0}</strong>
                    <small>{(data.emailsSent || []).filter((e: any) => e.status === "delivered").length} delivered</small>
                  </article>
                  <article className="platform-stat">
                    <span>Voice Call Events</span>
                    <strong>{data.voiceLogs?.length || 0}</strong>
                    <small>Calls &amp; wake-up schedules</small>
                  </article>
                </div>

                {/* Executive Summary Insights Card */}
                <section className="platform-card">
                  <div className="platform-heading">
                    <h2>Executive performance overview</h2>
                    <span>{days}-day reporting period</span>
                  </div>
                  <p style={{ lineHeight: "1.6", color: "var(--ink-light)" }}>
                    Responses {data.report.changes?.responses > 0 ? "increased" : "changed"} by{" "}
                    <strong>{Math.abs(data.report.changes?.responses || 0)}</strong> compared to the preceding period.
                    Average guest satisfaction {data.report.changes?.rating === null ? "has no prior baseline" : data.report.changes.rating > 0 ? `improved by ${data.report.changes.rating} points` : data.report.changes.rating < 0 ? `declined by ${Math.abs(data.report.changes.rating)} points` : "held steady"}.
                  </p>

                  <h3 style={{ marginTop: "20px", marginBottom: "10px", fontSize: "14px", fontWeight: "600" }}>Key Action Items</h3>
                  {!data.report.actions?.length ? (
                    <p style={{ color: "var(--muted)", fontSize: "13px" }}>No urgent action items were identified for this reporting window.</p>
                  ) : (
                    (data.report.actions || []).map((item: any) => (
                      <div className="platform-row" key={item.title}>
                        <span>
                          {item.title}
                          <small>{item.detail}</small>
                        </span>
                        <Link className="button button-ghost compact" href={item.href || "/dashboard"}>
                          Review
                        </Link>
                      </div>
                    ))
                  )}

                  <h3 style={{ marginTop: "24px", marginBottom: "10px", fontSize: "14px", fontWeight: "600" }}>Recurring Category Trends</h3>
                  {!data.report.recurring?.length ? (
                    <p style={{ color: "var(--muted)", fontSize: "13px" }}>No recurring complaint patterns identified across multiple incidents.</p>
                  ) : (
                    (data.report.recurring || []).map((item: any) => (
                      <div className="platform-row" key={item.name}>
                        <span>
                          {item.name}
                          <small>{item.count} reports · {item.lowRatings} low rating submissions</small>
                        </span>
                      </div>
                    ))
                  )}
                </section>

                {/* Property Benchmarks */}
                <section className="platform-card">
                  <div className="platform-heading">
                    <h2>Property Performance Benchmarks</h2>
                    <button
                      type="button"
                      className="button button-ghost compact"
                      onClick={() => exportToExcel("executive")}
                    >
                      <Download size={14} /> Export Table
                    </button>
                  </div>
                  <div className="platform-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Property</th>
                          <th>Guest Responses</th>
                          <th>Rating / 5</th>
                          <th>NPS</th>
                          <th>Open Cases</th>
                          <th>Overdue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(data.report.properties || []).map((p: any) => {
                          const propName = data.properties?.find((x: any) => x.id === p.name)?.name || p.name;
                          return (
                            <tr key={p.name}>
                              <td><strong>{propName}</strong></td>
                              <td>{p.responses}</td>
                              <td>{val(p.averageRating)}</td>
                              <td>{val(p.nps)}</td>
                              <td>{p.open}</td>
                              <td>
                                {p.overdue > 0 ? (
                                  <span style={{ color: "var(--danger, #b23b3b)", fontWeight: 600 }}>{p.overdue}</span>
                                ) : (
                                  "0"
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* Department Workload */}
                <section className="platform-card">
                  <h2>Departmental Satisfaction &amp; Workload</h2>
                  <div className="platform-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Department / Assignee</th>
                          <th>Responses</th>
                          <th>Rating / 5</th>
                          <th>NPS</th>
                          <th>Open</th>
                          <th>Overdue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(data.report.workload || []).map((w: any) => (
                          <tr key={w.name}>
                            <td>{w.name}</td>
                            <td>{w.responses}</td>
                            <td>{val(w.averageRating)}</td>
                            <td>{val(w.nps)}</td>
                            <td>{w.open}</td>
                            <td>{w.overdue}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}

            {/* TAB 2: EMAILS SENT & RECEIVED */}
            {tab === "emails" && (
              <>
                <div className="platform-stats" style={{ marginBottom: "20px" }}>
                  <article className="platform-stat">
                    <span>Total Outbound Emails</span>
                    <strong>{data.emailsSent?.length || 0}</strong>
                    <small>System &amp; notification outbox</small>
                  </article>
                  <article className="platform-stat">
                    <span>Delivered Outbox</span>
                    <strong>{(data.emailsSent || []).filter((e: any) => e.status === "delivered").length}</strong>
                    <small>Successfully delivered</small>
                  </article>
                  <article className="platform-stat">
                    <span>Delivery Failures</span>
                    <strong>{(data.emailsSent || []).filter((e: any) => ["failed", "blocked"].includes(e.status)).length}</strong>
                    <small>Requires review / retry</small>
                  </article>
                  <article className="platform-stat">
                    <span>Inbound Guest Contacts</span>
                    <strong>{data.emailsReceived?.length || 0}</strong>
                    <small>Feedback with email provided</small>
                  </article>
                </div>

                {/* Outbound Emails Sent Table */}
                <section className="platform-card">
                  <div className="platform-heading">
                    <h2>Outbound Emails Sent</h2>
                    <button
                      type="button"
                      className="button button-ghost compact"
                      onClick={() => exportToExcel("emails")}
                    >
                      <Download size={14} /> Export Outbox
                    </button>
                  </div>
                  <p style={{ color: "var(--muted)", fontSize: "13px", marginBottom: "16px" }}>
                    Automated feedback acknowledgements, resolution check-ins, guest invitations, and SLA target escalations.
                  </p>
                  <div className="platform-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Subject / Kind</th>
                          <th>Recipient</th>
                          <th>Status</th>
                          <th>Attempts</th>
                          <th>Date &amp; Time</th>
                          <th>Error Detail</th>
                        </tr>
                      </thead>
                      <tbody>
                        {!filteredEmailsSent.length ? (
                          <tr>
                            <td colSpan={6} style={{ textAlign: "center", color: "var(--muted)", padding: "24px" }}>
                              No outbound emails matching your criteria.
                            </td>
                          </tr>
                        ) : (
                          filteredEmailsSent.map((e: any) => (
                            <tr key={e.id}>
                              <td>
                                <strong>{getSubject(e)}</strong>
                                <small style={{ display: "block", color: "var(--muted)" }}>Kind: {e.kind}</small>
                              </td>
                              <td>{getRecipient(e)}</td>
                              <td>
                                <span
                                  style={{
                                    display: "inline-block",
                                    padding: "2px 8px",
                                    borderRadius: "12px",
                                    fontSize: "11px",
                                    fontWeight: "600",
                                    textTransform: "uppercase",
                                    backgroundColor:
                                      e.status === "delivered"
                                        ? "rgba(54, 107, 84, 0.15)"
                                        : e.status === "queued" || e.status === "sending"
                                        ? "rgba(224, 143, 30, 0.15)"
                                        : "rgba(180, 40, 40, 0.15)",
                                    color:
                                      e.status === "delivered"
                                        ? "#275941"
                                        : e.status === "queued" || e.status === "sending"
                                        ? "#a2620c"
                                        : "#a11f1f",
                                  }}
                                >
                                  {e.status}
                                </span>
                              </td>
                              <td>{e.attempts}</td>
                              <td>{date(e.created_at)}</td>
                              <td>{e.last_error ? <span style={{ color: "var(--danger)" }}>{e.last_error}</span> : "—"}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* Inbound Guest Emails & Contacts Table */}
                <section className="platform-card">
                  <div className="platform-heading">
                    <h2>Inbound Guest Messages &amp; Contact Records</h2>
                    <button
                      type="button"
                      className="button button-ghost compact"
                      onClick={() => exportToExcel("emails")}
                    >
                      <Download size={14} /> Export Inbound
                    </button>
                  </div>
                  <p style={{ color: "var(--muted)", fontSize: "13px", marginBottom: "16px" }}>
                    Verified guest responses with email or contact follow-up preferences.
                  </p>
                  <div className="platform-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Guest Name</th>
                          <th>Email Address</th>
                          <th>Phone</th>
                          <th>Room</th>
                          <th>Department</th>
                          <th>Rating</th>
                          <th>Wants Contact</th>
                          <th>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {!filteredEmailsReceived.length ? (
                          <tr>
                            <td colSpan={8} style={{ textAlign: "center", color: "var(--muted)", padding: "24px" }}>
                              No guest feedback with contact details recorded.
                            </td>
                          </tr>
                        ) : (
                          filteredEmailsReceived.map((g: any) => (
                            <tr key={g.id}>
                              <td><strong>{g.guest_name}</strong></td>
                              <td>{g.guest_email || "—"}</td>
                              <td>{g.guest_phone || "—"}</td>
                              <td>{g.room_number}</td>
                              <td>{g.department}</td>
                              <td>
                                <span style={{ fontWeight: 600 }}>{g.rating} / 5</span>
                              </td>
                              <td>
                                {g.wants_contact ? (
                                  <span style={{ color: "#275941", fontWeight: 600 }}>Yes ({g.contact_preference || "email"})</span>
                                ) : (
                                  <span style={{ color: "var(--muted)" }}>No</span>
                                )}
                              </td>
                              <td>{date(g.created_at)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}

            {/* TAB 3: VOICE & TELEPHONY */}
            {tab === "voice" && (
              <>
                <div className="platform-stats" style={{ marginBottom: "20px" }}>
                  <article className="platform-stat">
                    <span>Total Voice Events</span>
                    <strong>{data.voiceLogs?.length || 0}</strong>
                    <small>Calls, wake-ups &amp; voicemails</small>
                  </article>
                  <article className="platform-stat">
                    <span>Wake-up Calls</span>
                    <strong>{(data.voiceLogs || []).filter((v: any) => v.kind === "wake_up").length}</strong>
                    <small>Scheduled &amp; delivered</small>
                  </article>
                  <article className="platform-stat">
                    <span>Completed Calls</span>
                    <strong>{(data.voiceLogs || []).filter((v: any) => v.status === "completed").length}</strong>
                    <small>Verified connection</small>
                  </article>
                  <article className="platform-stat">
                    <span>Avg Call Duration</span>
                    <strong>
                      {Math.round(
                        (data.voiceLogs || []).reduce((acc: number, v: any) => acc + (v.duration_seconds || 0), 0) /
                          Math.max(1, data.voiceLogs?.length || 1)
                      )}{" "}
                      <span style={{ fontSize: "14px", fontWeight: "normal", color: "var(--muted)" }}>sec</span>
                    </strong>
                    <small>Average duration</small>
                  </article>
                </div>

                <section className="platform-card">
                  <div className="platform-heading">
                    <h2>Voice &amp; Telephony Event History</h2>
                    <button
                      type="button"
                      className="button button-ghost compact"
                      onClick={() => exportToExcel("voice")}
                    >
                      <Download size={14} /> Export Voice Logs
                    </button>
                  </div>
                  <p style={{ color: "var(--muted)", fontSize: "13px", marginBottom: "16px" }}>
                    Telephony events, wake-up calls, room-to-desk communications and voice records.
                  </p>
                  <div className="platform-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Event Kind</th>
                          <th>Destination / Room</th>
                          <th>Duration</th>
                          <th>Status</th>
                          <th>Notes</th>
                          <th>Scheduled At</th>
                          <th>Created At</th>
                        </tr>
                      </thead>
                      <tbody>
                        {!filteredVoice.length ? (
                          <tr>
                            <td colSpan={7} style={{ textAlign: "center", color: "var(--muted)", padding: "28px" }}>
                              No voice communications or wake-up calls logged for this period.
                            </td>
                          </tr>
                        ) : (
                          filteredVoice.map((v: any) => (
                            <tr key={v.id}>
                              <td>
                                <strong>
                                  {v.kind === "wake_up" ? "Wake-up Call" : v.kind === "voicemail" ? "Voicemail" : "Direct Call"}
                                </strong>
                              </td>
                              <td>{v.destination || "Guest Room"}</td>
                              <td>{v.duration_seconds ? `${v.duration_seconds}s` : "—"}</td>
                              <td>
                                <span
                                  style={{
                                    display: "inline-block",
                                    padding: "2px 8px",
                                    borderRadius: "12px",
                                    fontSize: "11px",
                                    fontWeight: "600",
                                    textTransform: "uppercase",
                                    backgroundColor:
                                      v.status === "completed"
                                        ? "rgba(54, 107, 84, 0.15)"
                                        : v.status === "scheduled" || v.status === "due"
                                        ? "rgba(224, 143, 30, 0.15)"
                                        : "rgba(100, 100, 100, 0.15)",
                                    color:
                                      v.status === "completed"
                                        ? "#275941"
                                        : v.status === "scheduled" || v.status === "due"
                                        ? "#a2620c"
                                        : "#555",
                                  }}
                                >
                                  {v.status}
                                </span>
                              </td>
                              <td>{v.notes || "—"}</td>
                              <td>{v.scheduled_at ? date(v.scheduled_at) : "—"}</td>
                              <td>{date(v.created_at)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}

            {/* TAB 4: SLA & COMPLAINTS */}
            {tab === "sla" && (
              <>
                <div className="platform-stats" style={{ marginBottom: "20px" }}>
                  <article className="platform-stat">
                    <span>Total Open Complaints</span>
                    <strong>{val(data.report?.current?.open)}</strong>
                    <small>Currently active cases</small>
                  </article>
                  <article className="platform-stat">
                    <span>Overdue Breaches</span>
                    <strong style={{ color: (data.report?.current?.overdue || 0) > 0 ? "var(--danger, #b23b3b)" : "inherit" }}>
                      {val(data.report?.current?.overdue)}
                    </strong>
                    <small>Exceeded SLA target</small>
                  </article>
                  <article className="platform-stat">
                    <span>Mean Response Time</span>
                    <strong>{val(data.report?.current?.meanResponseMinutes)} <span style={{ fontSize: "14px", fontWeight: "normal", color: "var(--muted)" }}>min</span></strong>
                    <small>First staff acknowledgement</small>
                  </article>
                  <article className="platform-stat">
                    <span>Mean Resolution Time</span>
                    <strong>{val(data.report?.current?.meanResolutionMinutes)} <span style={{ fontSize: "14px", fontWeight: "normal", color: "var(--muted)" }}>min</span></strong>
                    <small>Case closure duration</small>
                  </article>
                </div>

                <section className="platform-card">
                  <div className="platform-heading">
                    <h2>Complaint Categories &amp; Incident Volume</h2>
                    <button
                      type="button"
                      className="button button-ghost compact"
                      onClick={() => exportToExcel("sla")}
                    >
                      <Download size={14} /> Export SLA Report
                    </button>
                  </div>
                  <div className="platform-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Category</th>
                          <th>Total Incidents</th>
                          <th>Satisfaction / 5</th>
                          <th>NPS</th>
                          <th>Open Cases</th>
                          <th>Overdue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(data.report?.categories || []).map((c: any) => (
                          <tr key={c.name}>
                            <td><strong>{c.name}</strong></td>
                            <td>{c.responses}</td>
                            <td>{val(c.averageRating)}</td>
                            <td>{val(c.nps)}</td>
                            <td>{c.open}</td>
                            <td>
                              {c.overdue > 0 ? (
                                <span style={{ color: "var(--danger, #b23b3b)", fontWeight: 600 }}>{c.overdue}</span>
                              ) : (
                                "0"
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}

            {/* TAB 5: OPERATIONS & MAINTENANCE */}
            {tab === "operations" && (
              <>
                <div className="platform-stats" style={{ marginBottom: "20px" }}>
                  <article className="platform-stat">
                    <span>Service Jobs Tracked</span>
                    <strong>{data.serviceJobs?.length || 0}</strong>
                    <small>Operational tasks</small>
                  </article>
                  <article className="platform-stat">
                    <span>Pending Tasks</span>
                    <strong>{(data.serviceJobs || []).filter((j: any) => j.status !== "completed").length}</strong>
                    <small>In progress or queued</small>
                  </article>
                  <article className="platform-stat">
                    <span>Completed Jobs</span>
                    <strong>{(data.serviceJobs || []).filter((j: any) => j.status === "completed").length}</strong>
                    <small>Verified completion</small>
                  </article>
                  <article className="platform-stat">
                    <span>Service Properties</span>
                    <strong>{data.properties?.length || 0}</strong>
                    <small>Active hotel properties</small>
                  </article>
                </div>

                <section className="platform-card">
                  <div className="platform-heading">
                    <h2>Operational Service Jobs &amp; Maintenance Tasks</h2>
                    <button
                      type="button"
                      className="button button-ghost compact"
                      onClick={() => exportToExcel("everything")}
                    >
                      <Download size={14} /> Export Operations Audit
                    </button>
                  </div>
                  <div className="platform-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Task Title</th>
                          <th>Department</th>
                          <th>Property</th>
                          <th>Priority</th>
                          <th>Status</th>
                          <th>Created At</th>
                        </tr>
                      </thead>
                      <tbody>
                        {!(data.serviceJobs || []).length ? (
                          <tr>
                            <td colSpan={6} style={{ textAlign: "center", color: "var(--muted)", padding: "28px" }}>
                              No service jobs recorded for this property selection.
                            </td>
                          </tr>
                        ) : (
                          (data.serviceJobs || []).map((j: any) => (
                            <tr key={j.id}>
                              <td><strong>{j.title}</strong></td>
                              <td>{j.department}</td>
                              <td>{data.properties?.find((p: any) => p.id === j.property_id)?.name || "Main Property"}</td>
                              <td>
                                <span
                                  style={{
                                    fontWeight: 600,
                                    color:
                                      j.priority === "critical" || j.priority === "high"
                                        ? "var(--danger, #b23b3b)"
                                        : "inherit",
                                  }}
                                >
                                  {j.priority}
                                </span>
                              </td>
                              <td>{j.status}</td>
                              <td>{date(j.created_at)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}

            {/* TAB 6: CUSTOM REPORT BUILDER (EXCEL & PDF) */}
            {tab === "builder" && (
              <section className="platform-card">
                <div className="platform-heading">
                  <h2>Multi-Format Custom Report Generator</h2>
                  <span>Generate targeted exports in Excel (.xlsx) and PDF</span>
                </div>
                <p style={{ color: "var(--ink-light)", lineHeight: "1.6", marginBottom: "20px" }}>
                  Select reporting scopes, data ranges, and desired formats. Reports compile real-time telemetry, email outbox logs, guest surveys, and operational incident logs.
                </p>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px", marginBottom: "24px" }}>
                  {/* Card 1: Executive Intelligence */}
                  <div style={{ padding: "18px", border: "1px solid var(--line)", borderRadius: "8px", background: "var(--canvas, #f8faf9)" }}>
                    <h3 style={{ fontSize: "15px", fontWeight: "600", marginBottom: "6px" }}>1. Executive Performance Summary</h3>
                    <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "16px" }}>
                      Aggregated guest ratings, Net Promoter Scores, property comparisons, and recurring complaint trends.
                    </p>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        type="button"
                        className="button button-dark compact"
                        onClick={() => exportToExcel("executive")}
                      >
                        <FileSpreadsheet size={14} /> Excel (.xlsx)
                      </button>
                      <button
                        type="button"
                        className="button button-ghost compact"
                        onClick={() => {
                          setTab("overview");
                          setShowPdfModal(true);
                        }}
                      >
                        <Printer size={14} /> PDF Brief
                      </button>
                    </div>
                  </div>

                  {/* Card 2: Email Audit */}
                  <div style={{ padding: "18px", border: "1px solid var(--line)", borderRadius: "8px", background: "var(--canvas, #f8faf9)" }}>
                    <h3 style={{ fontSize: "15px", fontWeight: "600", marginBottom: "6px" }}>2. Email Communications Log</h3>
                    <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "16px" }}>
                      Every outbound message (acknowledgments, SLA escalations, invitations) and incoming guest responses.
                    </p>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        type="button"
                        className="button button-dark compact"
                        onClick={() => exportToExcel("emails")}
                      >
                        <FileSpreadsheet size={14} /> Excel (.xlsx)
                      </button>
                      <button
                        type="button"
                        className="button button-ghost compact"
                        onClick={() => {
                          setTab("emails");
                          setShowPdfModal(true);
                        }}
                      >
                        <Printer size={14} /> PDF Brief
                      </button>
                    </div>
                  </div>

                  {/* Card 3: Voice & Telephony */}
                  <div style={{ padding: "18px", border: "1px solid var(--line)", borderRadius: "8px", background: "var(--canvas, #f8faf9)" }}>
                    <h3 style={{ fontSize: "15px", fontWeight: "600", marginBottom: "6px" }}>3. Voice &amp; Telephony Audit</h3>
                    <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "16px" }}>
                      Wake-up call fulfillment, direct room calls, durations, operator notes, and completion statuses.
                    </p>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        type="button"
                        className="button button-dark compact"
                        onClick={() => exportToExcel("voice")}
                      >
                        <FileSpreadsheet size={14} /> Excel (.xlsx)
                      </button>
                      <button
                        type="button"
                        className="button button-ghost compact"
                        onClick={() => {
                          setTab("voice");
                          setShowPdfModal(true);
                        }}
                      >
                        <Printer size={14} /> PDF Brief
                      </button>
                    </div>
                  </div>

                  {/* Card 4: Master Operational Audit (Everything) */}
                  <div style={{ padding: "18px", border: "1px solid var(--line)", borderRadius: "8px", background: "var(--canvas, #f8faf9)" }}>
                    <h3 style={{ fontSize: "15px", fontWeight: "600", marginBottom: "6px" }}>4. Master Operational Audit (&ldquo;Everything&rdquo;)</h3>
                    <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "16px" }}>
                      Comprehensive multi-sheet audit combining Feedback, SLAs, Emails, Voice, and Service Jobs.
                    </p>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        type="button"
                        className="button button-dark compact"
                        onClick={() => exportToExcel("everything")}
                      >
                        <FileSpreadsheet size={14} /> Complete Excel (.xlsx)
                      </button>
                      <button
                        type="button"
                        className="button button-ghost compact"
                        onClick={() => setShowPdfModal(true)}
                      >
                        <Printer size={14} /> Executive PDF
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            )}
          </>
        )}

        {/* PRINTABLE PDF MODAL PREVIEW */}
        {showPdfModal && data && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(0, 0, 0, 0.65)",
              zIndex: 9999,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              padding: "20px",
              backdropFilter: "blur(4px)",
            }}
          >
            <div
              style={{
                backgroundColor: "#ffffff",
                color: "#111827",
                width: "100%",
                maxWidth: "850px",
                maxHeight: "90vh",
                overflowY: "auto",
                borderRadius: "10px",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Modal Top Actions Toolbar */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "16px 24px",
                  borderBottom: "1px solid #e5e7eb",
                  backgroundColor: "#f9fafb",
                }}
              >
                <div>
                  <h3 style={{ fontSize: "16px", fontWeight: "600", margin: 0 }}>Executive PDF Document Preview</h3>
                  <small style={{ color: "#6b7280" }}>Ready for printing and saving as PDF</small>
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    type="button"
                    className="button button-dark compact"
                    onClick={handlePrint}
                    style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    <Printer size={15} /> Print / Save as PDF
                  </button>
                  <button
                    type="button"
                    className="button button-ghost compact"
                    onClick={() => setShowPdfModal(false)}
                  >
                    <X size={16} /> Close
                  </button>
                </div>
              </div>

              {/* Printable Document Body */}
              <div ref={pdfRef} style={{ padding: "36px 40px" }} id="printable-executive-report">
                {/* Executive Letterhead */}
                <div style={{ borderBottom: "2px solid #111827", paddingBottom: "20px", marginBottom: "24px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <h1 style={{ fontFamily: "Playfair Display, Georgia, serif", fontSize: "24px", margin: "0 0 4px 0", letterSpacing: "0.02em" }}>
                        VISTORA
                      </h1>
                      <p style={{ margin: 0, fontSize: "11px", letterSpacing: "0.15em", textTransform: "uppercase", color: "#4b5563" }}>
                        Guest Experience Operations &amp; Intelligence
                      </p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: "12px", fontWeight: "600", color: "#111827", display: "block" }}>
                        EXECUTIVE AUDIT REPORT
                      </span>
                      <small style={{ color: "#6b7280", fontSize: "11px" }}>Generated: {new Date().toLocaleString()}</small>
                    </div>
                  </div>
                </div>

                {/* Report Parameters Box */}
                <div style={{ backgroundColor: "#f3f4f6", padding: "12px 16px", borderRadius: "6px", marginBottom: "24px", display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                  <div>
                    <span style={{ color: "#6b7280" }}>Organization:</span> <strong>{data.organization?.name || "Vistora"}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#6b7280" }}>Period:</span> <strong>Last {days} days</strong>
                  </div>
                  <div>
                    <span style={{ color: "#6b7280" }}>Property Filter:</span>{" "}
                    <strong>{property === "all" ? "All Properties" : data.properties?.find((p: any) => p.id === property)?.name || property}</strong>
                  </div>
                </div>

                {/* Executive Key Indicators Grid */}
                <h3 style={{ fontSize: "13px", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: "12px", color: "#374151" }}>
                  Operational Telemetry &amp; KPI Summary
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "28px" }}>
                  <div style={{ padding: "12px", border: "1px solid #e5e7eb", borderRadius: "6px" }}>
                    <small style={{ color: "#6b7280", display: "block", fontSize: "11px" }}>Guest Responses</small>
                    <strong style={{ fontSize: "20px" }}>{val(data.report?.current?.responses)}</strong>
                  </div>
                  <div style={{ padding: "12px", border: "1px solid #e5e7eb", borderRadius: "6px" }}>
                    <small style={{ color: "#6b7280", display: "block", fontSize: "11px" }}>Average Satisfaction</small>
                    <strong style={{ fontSize: "20px" }}>{val(data.report?.current?.averageRating)} / 5</strong>
                  </div>
                  <div style={{ padding: "12px", border: "1px solid #e5e7eb", borderRadius: "6px" }}>
                    <small style={{ color: "#6b7280", display: "block", fontSize: "11px" }}>Net Promoter Score</small>
                    <strong style={{ fontSize: "20px" }}>{val(data.report?.current?.nps)}</strong>
                  </div>
                  <div style={{ padding: "12px", border: "1px solid #e5e7eb", borderRadius: "6px" }}>
                    <small style={{ color: "#6b7280", display: "block", fontSize: "11px" }}>Active Cases (Overdue)</small>
                    <strong style={{ fontSize: "20px" }}>{val(data.report?.current?.open)} ({val(data.report?.current?.overdue)})</strong>
                  </div>
                  <div style={{ padding: "12px", border: "1px solid #e5e7eb", borderRadius: "6px" }}>
                    <small style={{ color: "#6b7280", display: "block", fontSize: "11px" }}>Emails Sent (Delivered)</small>
                    <strong style={{ fontSize: "20px" }}>
                      {data.emailsSent?.length || 0} ({(data.emailsSent || []).filter((e: any) => e.status === "delivered").length})
                    </strong>
                  </div>
                  <div style={{ padding: "12px", border: "1px solid #e5e7eb", borderRadius: "6px" }}>
                    <small style={{ color: "#6b7280", display: "block", fontSize: "11px" }}>Voice Call Events</small>
                    <strong style={{ fontSize: "20px" }}>{data.voiceLogs?.length || 0}</strong>
                  </div>
                </div>

                {/* Benchmark Table in PDF */}
                <h3 style={{ fontSize: "13px", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: "10px", color: "#374151" }}>
                  Property Performance Benchmarks
                </h3>
                <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "28px", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ borderBottom: "1.5px solid #111827", textAlign: "left" }}>
                      <th style={{ padding: "6px 8px" }}>Property</th>
                      <th style={{ padding: "6px 8px" }}>Responses</th>
                      <th style={{ padding: "6px 8px" }}>Rating / 5</th>
                      <th style={{ padding: "6px 8px" }}>NPS</th>
                      <th style={{ padding: "6px 8px" }}>Open Cases</th>
                      <th style={{ padding: "6px 8px" }}>Overdue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.report?.properties || []).map((p: any) => {
                      const propName = data.properties?.find((x: any) => x.id === p.name)?.name || p.name;
                      return (
                        <tr key={p.name} style={{ borderBottom: "1px solid #e5e7eb" }}>
                          <td style={{ padding: "6px 8px", fontWeight: "600" }}>{propName}</td>
                          <td style={{ padding: "6px 8px" }}>{p.responses}</td>
                          <td style={{ padding: "6px 8px" }}>{val(p.averageRating)}</td>
                          <td style={{ padding: "6px 8px" }}>{val(p.nps)}</td>
                          <td style={{ padding: "6px 8px" }}>{p.open}</td>
                          <td style={{ padding: "6px 8px" }}>{p.overdue}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Departmental Table in PDF */}
                <h3 style={{ fontSize: "13px", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: "10px", color: "#374151" }}>
                  Departmental Compliance &amp; Workload
                </h3>
                <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "28px", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ borderBottom: "1.5px solid #111827", textAlign: "left" }}>
                      <th style={{ padding: "6px 8px" }}>Department</th>
                      <th style={{ padding: "6px 8px" }}>Responses</th>
                      <th style={{ padding: "6px 8px" }}>Rating / 5</th>
                      <th style={{ padding: "6px 8px" }}>Open Cases</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.report?.categories || []).map((c: any) => (
                      <tr key={c.name} style={{ borderBottom: "1px solid #e5e7eb" }}>
                        <td style={{ padding: "6px 8px", fontWeight: "500" }}>{c.name}</td>
                        <td style={{ padding: "6px 8px" }}>{c.responses}</td>
                        <td style={{ padding: "6px 8px" }}>{val(c.averageRating)}</td>
                        <td style={{ padding: "6px 8px" }}>{c.open}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Footer in PDF */}
                <div style={{ marginTop: "40px", paddingTop: "16px", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#6b7280" }}>
                  <span>Confidential — Internal Hospitality Management Document</span>
                  <span>Vistora Hotel Operations &amp; Guest Experience Platform</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

