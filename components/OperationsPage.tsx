"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { motion } from "framer-motion";
import {
  Download,
  Printer,
  Copy,
  Check,
  ExternalLink,
  FileSpreadsheet,
  AlertTriangle,
  Users,
  BarChart3,
  Building2,
  FileText,
  Search,
} from "lucide-react";
import { AppShell, FeedbackTable } from "./Dashboard";
import { DashboardData, PropertyRow } from "../types/experience";
import CustomDatePicker, { DateRangeFilter, isDateInRange } from "./CustomDatePicker";
import PropertyFilter from "./PropertyFilter";
import QuestionnaireBuilder from "./QuestionnaireBuilder";
import CustomSelect from "./CustomSelect";

export default function OperationsPage({ section, data }: { section: string; data: DashboardData }) {
  const [query, setQuery] = useState("");
  const [selectedProperty, setSelectedProperty] = useState<string | "all">("all");
  const [dateFilter, setDateFilter] = useState<DateRangeFilter>({
    preset: "all",
    startDate: null,
    endDate: null,
  });

  const feedback = useMemo(
    () =>
      data.recentFeedback
        .filter((item) => section !== "complaints" || item.rating <= 2 || item.status === "needs_attention")
        .filter((item) => selectedProperty === "all" || !item.propertyId || item.propertyId === selectedProperty)
        .filter((item) => isDateInRange(item.createdAt, dateFilter))
        .filter((item) => !query || `${item.name} ${item.roomNumber} ${item.department} ${item.comment || ""}`.toLowerCase().includes(query.toLowerCase())),
    [data.recentFeedback, query, section, selectedProperty, dateFilter]
  );

  const title =
    section === "complaints"
      ? "Complaints & service recovery"
      : section === "feedback"
      ? "All guest feedback"
      : section === "analytics"
      ? "Analytics"
      : section === "directory"
      ? "Guest directory"
      : section === "questionnaire"
      ? "Questionnaire"
      : section === "forms"
      ? "Feedback forms"
      : section === "qr-codes"
      ? "QR codes"
      : "Reports";

  const descriptions: Record<string, string> = {
    complaints: "Prioritize low ratings, contact requests, and open recovery work.",
    feedback: "Review every guest submission captured across the workspace.",
    analytics: "Understand satisfaction and response patterns across properties.",
    directory: "A searchable guest view derived from recorded stays and feedback.",
    forms: "Manage public feedback forms and configure questionnaire questions.",
    questionnaire: "Design and customize questions asked to guests on the feedback form.",
    "qr-codes": "Create trackable QR codes for rooms, departments, and guest touchpoints.",
    reports: "Export operational records for reviews and follow-up.",
  };

  const navLabel =
    section === "complaints"
      ? "Complaints"
      : section === "feedback"
      ? "All feedback"
      : section === "analytics"
      ? "Analytics"
      : section === "directory"
      ? "Guest directory"
      : section === "questionnaire"
      ? "Questionnaire"
      : section === "forms"
      ? "Feedback forms"
      : section === "qr-codes"
      ? "QR codes"
      : "Reports";

  return (
    <AppShell active={navLabel} complaints={Number(data.metrics.openComplaints.value)}>
      <div className="content-wrap">
        <div className="page-heading">
          <div>
            <p className="eyebrow">Guest experience operations</p>
            <h1>{title}</h1>
            <p className="subheading">{descriptions[section]}</p>
          </div>
          <div className="page-heading-actions">
            <PropertyFilter
              properties={data.properties}
              selectedId={selectedProperty}
              onChange={setSelectedProperty}
            />
            <CustomDatePicker
              value={dateFilter}
              onChange={setDateFilter}
            />
            {section === "reports" && (
              <button
                className="button button-outline compact"
                onClick={() => window.print()}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <Printer size={13} />
                <span>Print / Save PDF</span>
              </button>
            )}
          </div>
        </div>

        <motion.div
          key={section}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
        >
          {section === "analytics" ? (
            <Analytics
              data={data}
              selectedProperty={selectedProperty}
              dateFilter={dateFilter}
            />
          ) : section === "directory" ? (
            <Directory data={data} query={query} setQuery={setQuery} />
          ) : section === "forms" ? (
            <Forms />
          ) : section === "questionnaire" ? (
            <QuestionnaireBuilder />
          ) : section === "qr-codes" ? (
            <QrCodes properties={data.properties} />
          ) : section === "reports" ? (
            <Reports data={data} selectedProperty={selectedProperty} dateFilter={dateFilter} />
          ) : (
            <>
              <div className="table-toolbar page-toolbar">
                <input
                  className="auth-input"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search guest, room, department, or comment…"
                  style={{ maxWidth: "340px", flex: 1 }}
                />
                <span className="toolbar-count">{feedback.length} records</span>
              </div>
              <FeedbackTable
                feedback={feedback}
                title={section === "complaints" ? "Open recovery queue" : "Feedback records"}
              />
            </>
          )}
        </motion.div>
      </div>
    </AppShell>
  );
}

function Analytics({
  data,
  selectedProperty,
  dateFilter,
}: {
  data: DashboardData;
  selectedProperty: string | "all";
  dateFilter: DateRangeFilter;
}) {
  const filteredFeedback = useMemo(() => {
    return data.recentFeedback.filter((item) => {
      if (selectedProperty !== "all" && item.propertyId && item.propertyId !== selectedProperty) {
        return false;
      }
      if (!isDateInRange(item.createdAt, dateFilter)) {
        return false;
      }
      return true;
    });
  }, [data.recentFeedback, selectedProperty, dateFilter]);

  const total = filteredFeedback.length;
  const totalRatingSum = filteredFeedback.reduce((acc, curr) => acc + curr.rating, 0);
  const avgRating = total > 0 ? (totalRatingSum / total).toFixed(2) : "5.00";
  const satisfiedCount = filteredFeedback.filter((r) => r.rating >= 4).length;
  const satisfactionRate = total > 0 ? ((satisfiedCount / total) * 100).toFixed(1) : "100.0";
  const openComplaintsCount = filteredFeedback.filter(
    (r) => r.status === "needs_attention" || r.status === "escalated" || r.rating <= 2
  ).length;

  const distributionCounts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  for (const row of filteredFeedback) {
    if (row.rating >= 1 && row.rating <= 5) {
      distributionCounts[row.rating] = (distributionCounts[row.rating] || 0) + 1;
    }
  }

  const bars = [5, 4, 3, 2, 1].map((stars) => {
    const count = distributionCounts[stars] || 0;
    const percentage = total > 0 ? `${Math.round((count / total) * 100)}%` : "0%";
    return {
      stars: String(stars),
      percentage,
      count,
    };
  });

  const departments = Array.from(new Set(filteredFeedback.map((item) => item.department)));

  return (
    <>
      <section className="metric-grid">
        <div className="metric-card">
          <span className="metric-label">Average rating</span>
          <div className="metric-value">
            {avgRating}
            <small>/ 5</small>
          </div>
          <div className="metric-change">Across {total} responses</div>
        </div>
        <div className="metric-card">
          <span className="metric-label">Satisfaction rate</span>
          <div className="metric-value">
            {satisfactionRate}
            <small>%</small>
          </div>
          <div className="metric-change">{satisfiedCount} satisfied responses (4★ & 5★)</div>
        </div>
        <div className="metric-card">
          <span className="metric-label">Open complaints</span>
          <div className="metric-value">{openComplaintsCount}</div>
          <div className="metric-change">{openComplaintsCount > 0 ? "Requires follow-up" : "All resolved"}</div>
        </div>
        <div className="metric-card">
          <span className="metric-label">Properties</span>
          <div className="metric-value">
            {selectedProperty === "all" ? data.properties.length : 1}
          </div>
          <div className="metric-change">
            {selectedProperty === "all" ? "Connected properties" : "Filtered property"}
          </div>
        </div>
      </section>

      <div className="panel analytics-panel">
        <div className="panel-heading">
          <div>
            <h2>Rating distribution</h2>
            <p>Response volume by rating</p>
          </div>
          <span className="panel-action">{total} responses</span>
        </div>
        <div className="rating-bars analytics-bars">
          {bars.map((bar) => (
            <div className="bar-row analytics-bar-row" key={bar.stars}>
              <span className="bar-label">{bar.stars} stars</span>
              <div className="bar-track">
                <i style={{ width: bar.percentage }} />
              </div>
              <strong className="bar-value">
                {bar.count} <small>({bar.percentage})</small>
              </strong>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="panel-heading">
          <div>
            <h2>Department signal</h2>
            <p>Where guest feedback is being generated</p>
          </div>
        </div>
        <div className="department-grid">
          {departments.length > 0 ? (
            departments.map((department) => (
              <div className="department-stat" key={department}>
                <strong>{department}</strong>
                <span>
                  {filteredFeedback.filter((item) => item.department === department).length} responses
                </span>
              </div>
            ))
          ) : (
            <p className="empty-state">No department signal data available for this filter.</p>
          )}
        </div>
      </div>
    </>
  );
}


function Directory({
  data,
  query,
  setQuery,
}: {
  data: DashboardData;
  query: string;
  setQuery: (value: string) => void;
}) {
  const guests = data.recentFeedback.filter(
    (item) => !query || `${item.name} ${item.roomNumber}`.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="panel">
      <div className="panel-heading">
        <div>
          <h2>Guest records</h2>
          <p>{guests.length} matching feedback profiles</p>
        </div>
        <input
          className="compact-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search guests"
        />
      </div>
      <div className="directory-grid">
        {guests.map((guest) => (
          <div className="directory-card" key={guest.id}>
            <span className="mini-avatar">{guest.initials}</span>
            <div>
              <strong>{guest.name}</strong>
              <p>
                {guest.roomNumber} · {guest.department}
              </p>
              <small>{guest.guestEmail || guest.guestPhone || "No contact details provided"}</small>
            </div>
            <span className={`status ${guest.tone}`}>{guest.rating}/5</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Forms() {
  return (
    <>
      <div className="form-grid">
        <div className="panel form-card">
          <span className="form-status">ACTIVE</span>
          <h2>Guest feedback form</h2>
          <p>Public form for collecting ratings, department context, comments, and optional manager follow-up.</p>
          <code>/feedback</code>
          <div className="form-card-actions">
            <Link className="button button-dark compact" href="/feedback">
              Open form ↗
            </Link>
            <Link className="panel-action" href="/dashboard/qr-codes">
              Create QR link
            </Link>
          </div>
        </div>
        <div className="panel form-card muted-card">
          <span className="form-status">CONFIGURATION</span>
          <h2>What the form captures</h2>
          <ul>
            <li>1–5 guest rating & experience department</li>
            <li>Customizable multi-question questionnaire options</li>
            <li>Written guest commentary & contact request</li>
            <li>Direct database sync with operational dashboard</li>
          </ul>
        </div>
      </div>
      <QuestionnaireBuilder />
    </>
  );
}

function exportToExcelCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escapeCell = (val: string | number) => {
    const str = val === null || val === undefined ? "" : String(val);
    return `"${str.replaceAll('"', '""')}"`;
  };

  const csvContent = [
    headers.map(escapeCell).join(","),
    ...rows.map((row) => row.map(escapeCell).join(",")),
  ].join("\r\n");

  // UTF-8 BOM \uFEFF ensures Microsoft Excel recognizes UTF-8 properly across Mac & Windows
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function QrCodes({ properties = [] }: { properties?: PropertyRow[] }) {
  const [label, setLabel] = useState("Guest Room Key Card");
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>(properties[0]?.id || "");
  const [isDemoLink, setIsDemoLink] = useState(true);
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  const selectedProp = properties.find((p) => p.id === selectedPropertyId);

  const url = useMemo(() => {
    const origin = typeof window === "undefined" ? "https://vistora.app" : window.location.origin;
    const params = new URLSearchParams();
    if (selectedPropertyId) {
      params.set("property", selectedPropertyId);
    }
    if (isDemoLink) {
      params.set("demo", "true");
    }
    const query = params.toString();
    return `${origin}/feedback${query ? `?${query}` : ""}`;
  }, [selectedPropertyId, isDemoLink]);

  useEffect(() => {
    QRCode.toDataURL(url, {
      width: 320,
      margin: 2,
      color: {
        dark: "#0b100f",
        light: "#ffffff",
      },
    })
      .then((dataUri) => setQrDataUrl(dataUri))
      .catch((err) => console.error("QR Code generation error:", err));
  }, [url]);

  function downloadQr() {
    if (!qrDataUrl) return;
    const link = document.createElement("a");
    link.href = qrDataUrl;
    const propCode = selectedProp?.code?.toLowerCase() || "vistora";
    link.download = `vistora-qr-${propCode}-${label.toLowerCase().replace(/[^a-z0-9]/g, "-")}.png`;
    link.click();
  }

  return (
    <div className="qr-layout">
      <div className="panel qr-card">
        <p className="eyebrow">Direct guest touchpoint & demo links</p>
        <h2>Guest feedback & demo link generator</h2>
        <p>
          Send an instant link or place a QR code. When sending a link from your side, the selected property will be automatically pre-selected for the guest.
        </p>

        <div style={{ marginTop: "20px", marginBottom: "22px" }}>
          <label className="field-label" style={{ display: "block", marginBottom: "8px" }}>
            Target Property (Pre-selects for Guest)
          </label>
          <CustomSelect
            value={selectedPropertyId}
            onChange={(val) => setSelectedPropertyId(val)}
            placeholder="-- No pre-selection (guest chooses) --"
            header="Target Property Selection"
            options={[
              { value: "", label: "No pre-selection (guest chooses location)", detail: "Guest selects property upon opening form" },
              ...properties.map((p) => ({
                value: p.id,
                label: `${p.name} (${p.code})`,
                detail: `${p.location} · ${p.total_rooms || 0} rooms`,
              })),
            ]}
          />
        </div>

        <div style={{ marginBottom: "22px" }}>
          <label className="field-label" style={{ display: "block", marginBottom: "8px" }}>
            Placement / Campaign Label
          </label>
          <input className="auth-input" value={label} onChange={(event) => setLabel(event.target.value)} />
        </div>

        <div style={{ marginBottom: "22px", padding: "14px 16px", background: "#f8faf8", border: "1px solid var(--line)", borderRadius: "6px" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13px", cursor: "pointer", fontWeight: 500 }}>
            <input
              type="checkbox"
              checked={isDemoLink}
              onChange={(e) => setIsDemoLink(e.target.checked)}
              style={{ accentColor: "#0b100f" }}
            />
            <span>Send as demo link (pre-loads verified hotel stay)</span>
          </label>
          <p style={{ margin: "6px 0 0 24px", color: "var(--muted)", fontSize: "11px", lineHeight: "1.5" }}>
            The guest opens the link with {selectedProp ? selectedProp.name : "the selected property"} automatically locked in.
          </p>
        </div>

        <div style={{ marginBottom: "22px" }}>
          <label className="field-label" style={{ display: "block", marginBottom: "8px" }}>
            Generated Link (Share with Guest or Prospect)
          </label>
          <input className="auth-input" value={url} readOnly />
        </div>

        <div style={{ display: "flex", gap: "10px", marginTop: "18px", flexWrap: "wrap" }}>
          <button
            type="button"
            className="button button-dark"
            onClick={async () => {
              await navigator.clipboard?.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <span>{copied ? "Link copied!" : "Copy link"}</span>
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="button button-outline"
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <ExternalLink size={14} />
            <span>Open preview ↗</span>
          </a>
          <button
            type="button"
            className="button button-outline"
            onClick={downloadQr}
            disabled={!qrDataUrl}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <Download size={14} />
            <span>Download QR PNG</span>
          </button>
        </div>
      </div>

      <div className="panel qr-preview" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px", textAlign: "center" }}>
        {qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt={`QR Code for ${label}`}
            style={{ width: "200px", height: "200px", borderRadius: "8px", border: "1px solid var(--line)", background: "#fff", padding: "8px", boxShadow: "var(--shadow-xs)" }}
          />
        ) : (
          <div style={{ width: "200px", height: "200px", display: "grid", placeItems: "center", border: "1px solid var(--line)", borderRadius: "8px" }}>
            Generating QR…
          </div>
        )}
        <strong style={{ marginTop: "16px", fontSize: "14px" }}>{label}</strong>
        {selectedProp && (
          <span style={{ fontSize: "11px", color: "var(--sage-deep)", background: "#edf4ed", padding: "2px 8px", borderRadius: "4px", marginTop: "4px" }}>
            {selectedProp.name} ({selectedProp.code})
          </span>
        )}
        <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: "11px" }}>Scan with camera or mobile device to open feedback</p>
      </div>
    </div>
  );
}

function Reports({
  data,
  selectedProperty,
  dateFilter,
}: {
  data: DashboardData;
  selectedProperty: string | "all";
  dateFilter: DateRangeFilter;
}) {
  const [activeTab, setActiveTab] = useState<"feedback" | "complaints" | "directory" | "scorecard">("feedback");
  const [reportSearch, setReportSearch] = useState("");

  // Base feedback matching property filter and date filter
  const baseFeedback = useMemo(() => {
    return data.recentFeedback
      .filter((item) => selectedProperty === "all" || !item.propertyId || item.propertyId === selectedProperty)
      .filter((item) => isDateInRange(item.createdAt, dateFilter));
  }, [data.recentFeedback, selectedProperty, dateFilter]);

  // Complaints dataset (<= 2 stars or needs_attention)
  const complaintsData = useMemo(() => {
    return baseFeedback.filter((item) => item.rating <= 2 || item.status === "needs_attention");
  }, [baseFeedback]);

  // Guest directory dataset (deduplicated by guest name & room)
  const guestDirectoryData = useMemo(() => {
    const map = new Map<string, typeof baseFeedback[0]>();
    for (const item of baseFeedback) {
      const key = `${item.name.toLowerCase()}-${item.roomNumber}`;
      if (!map.has(key)) map.set(key, item);
    }
    return Array.from(map.values());
  }, [baseFeedback]);

  // Department Scorecard
  const departmentScorecard = useMemo(() => {
    const depts = ["Front Desk", "Housekeeping", "Dining", "Spa & Wellness", "Facilities", "Concierge"];
    return depts.map((d) => {
      const items = baseFeedback.filter((f) => f.department.toLowerCase() === d.toLowerCase());
      const total = items.length;
      const avg = total > 0 ? (items.reduce((acc, cur) => acc + cur.rating, 0) / total).toFixed(1) : "—";
      const complaintCount = items.filter((f) => f.rating <= 2).length;
      const recoveryRate = total > 0 ? Math.round(((total - complaintCount) / total) * 100) : 100;
      return { department: d, total, avgRating: avg, complaintCount, recoveryRate };
    });
  }, [baseFeedback]);

  // Filtered views by search query
  const displayedFeedback = useMemo(() => {
    if (!reportSearch) return baseFeedback;
    const q = reportSearch.toLowerCase();
    return baseFeedback.filter((item) =>
      `${item.name} ${item.roomNumber} ${item.department} ${item.comment || ""}`.toLowerCase().includes(q)
    );
  }, [baseFeedback, reportSearch]);

  const displayedComplaints = useMemo(() => {
    if (!reportSearch) return complaintsData;
    const q = reportSearch.toLowerCase();
    return complaintsData.filter((item) =>
      `${item.name} ${item.roomNumber} ${item.department} ${item.comment || ""}`.toLowerCase().includes(q)
    );
  }, [complaintsData, reportSearch]);

  const displayedGuests = useMemo(() => {
    if (!reportSearch) return guestDirectoryData;
    const q = reportSearch.toLowerCase();
    return guestDirectoryData.filter((item) =>
      `${item.name} ${item.roomNumber} ${item.guestEmail || ""} ${item.guestPhone || ""}`.toLowerCase().includes(q)
    );
  }, [guestDirectoryData, reportSearch]);

  // Export handlers
  function exportDatewiseFeedback() {
    const headers = [
      "Guest Name",
      "Room Number",
      "Property Name",
      "Property Code",
      "Department",
      "Rating (1-5)",
      "Resolution Status",
      "Guest Email",
      "Guest Phone",
      "Manager Contact Requested",
      "Guest Commentary",
      "Submission Date",
    ];
    const rows = baseFeedback.map((f) => {
      const prop = data.properties.find((p) => p.id === f.propertyId);
      return [
        f.name,
        f.roomNumber,
        prop?.name || "General Property",
        prop?.code || "GEN",
        f.department,
        f.rating,
        f.statusLabel,
        f.guestEmail || "",
        f.guestPhone || "",
        f.wantsContact ? `Yes (${f.contactPreference || "email"})` : "No",
        f.comment || "",
        f.createdAt,
      ];
    });
    exportToExcelCsv("vistora-datewise-feedback-report", headers, rows);
  }

  function exportComplaints() {
    const headers = [
      "Guest Name",
      "Room Number",
      "Property Name",
      "Property Code",
      "Department",
      "Rating",
      "Status",
      "Assigned Duty Staff",
      "Resolution Notes",
      "Guest Contact",
      "Incident Detail / Comment",
      "Logged Date",
    ];
    const rows = complaintsData.map((f) => {
      const prop = data.properties.find((p) => p.id === f.propertyId);
      return [
        f.name,
        f.roomNumber,
        prop?.name || "General Property",
        prop?.code || "GEN",
        f.department,
        f.rating,
        f.statusLabel,
        f.assignedTo || "Unassigned",
        f.resolutionNotes || "Pending review",
        f.guestEmail || f.guestPhone || "No contact",
        f.comment || f.detail || "",
        f.createdAt,
      ];
    });
    exportToExcelCsv("vistora-complaint-recovery-report", headers, rows);
  }

  function exportGuestDirectory() {
    const headers = [
      "Guest Name",
      "Room Number",
      "Property Name",
      "Contact Email",
      "Contact Phone",
      "Latest Rating Given",
      "Latest Department",
      "Last Visit / Stay Date",
    ];
    const rows = guestDirectoryData.map((g) => {
      const prop = data.properties.find((p) => p.id === g.propertyId);
      return [
        g.name,
        g.roomNumber,
        prop?.name || "General Property",
        g.guestEmail || "N/A",
        g.guestPhone || "N/A",
        g.rating,
        g.department,
        g.createdAt,
      ];
    });
    exportToExcelCsv("vistora-guest-directory-report", headers, rows);
  }

  function exportScorecard() {
    const headers = ["Department", "Total Feedback Records", "Average Star Rating", "Complaint Count", "Satisfaction / Recovery Rate (%)"];
    const rows = departmentScorecard.map((s) => [
      s.department,
      s.total,
      s.avgRating,
      s.complaintCount,
      `${s.recoveryRate}%`,
    ]);
    exportToExcelCsv("vistora-department-scorecard", headers, rows);
  }

  const selectedPropObj = data.properties.find((p) => p.id === selectedProperty);
  const activePropertyLabel = selectedProperty === "all" ? "All Properties (Portfolio)" : `${selectedPropObj?.name} (${selectedPropObj?.code})`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* 4 Report Category Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
        {/* Card 1: Date-wise Feedback Report */}
        <div
          className="panel"
          style={{
            padding: "18px 20px",
            border: activeTab === "feedback" ? "2px solid var(--ink)" : "1px solid var(--line)",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onClick={() => setActiveTab("feedback")}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
            <span className="eyebrow" style={{ margin: 0 }}>Date-wise Report</span>
            <FileSpreadsheet size={16} strokeWidth={1.75} style={{ color: "var(--muted)" }} />
          </div>
          <h3 style={{ fontSize: "16px", margin: "4px 0" }}>Guest Feedback Audit</h3>
          <p style={{ fontSize: "12px", color: "var(--muted)", margin: "0 0 14px", lineHeight: "1.4" }}>
            Complete submissions, ratings, and questionnaire answers for the selected dates.
          </p>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", fontWeight: 600 }}>{baseFeedback.length} records</span>
            <button
              className="button button-dark compact"
              onClick={(e) => {
                e.stopPropagation();
                exportDatewiseFeedback();
              }}
              style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "4px 9px", fontSize: "11px" }}
              title="Download Excel CSV"
            >
              <Download size={12} />
              Excel / CSV
            </button>
          </div>
        </div>

        {/* Card 2: Complaints & Recovery Report */}
        <div
          className="panel"
          style={{
            padding: "18px 20px",
            border: activeTab === "complaints" ? "2px solid var(--ink)" : "1px solid var(--line)",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onClick={() => setActiveTab("complaints")}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
            <span className="eyebrow" style={{ margin: 0 }}>Escalation Audit</span>
            <AlertTriangle size={16} strokeWidth={1.75} style={{ color: "var(--muted)" }} />
          </div>
          <h3 style={{ fontSize: "16px", margin: "4px 0" }}>Complaints & Recovery</h3>
          <p style={{ fontSize: "12px", color: "var(--muted)", margin: "0 0 14px", lineHeight: "1.4" }}>
            Low scores (≤2 stars), recovery assignees, SLA turnarounds, and resolution notes.
          </p>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", fontWeight: 600, color: complaintsData.length > 0 ? "var(--ink)" : "var(--muted)" }}>
              {complaintsData.length} complaints
            </span>
            <button
              className="button button-dark compact"
              onClick={(e) => {
                e.stopPropagation();
                exportComplaints();
              }}
              style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "4px 9px", fontSize: "11px" }}
              title="Download Excel CSV"
            >
              <Download size={12} />
              Excel / CSV
            </button>
          </div>
        </div>

        {/* Card 3: Guest Directory Report */}
        <div
          className="panel"
          style={{
            padding: "18px 20px",
            border: activeTab === "directory" ? "2px solid var(--ink)" : "1px solid var(--line)",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onClick={() => setActiveTab("directory")}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
            <span className="eyebrow" style={{ margin: 0 }}>Guest Intelligence</span>
            <Users size={16} strokeWidth={1.75} style={{ color: "var(--muted)" }} />
          </div>
          <h3 style={{ fontSize: "16px", margin: "4px 0" }}>Guest Directory</h3>
          <p style={{ fontSize: "12px", color: "var(--muted)", margin: "0 0 14px", lineHeight: "1.4" }}>
            Unique guest profiles, verified contact emails, phone numbers, and stay history.
          </p>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", fontWeight: 600 }}>{guestDirectoryData.length} guests</span>
            <button
              className="button button-dark compact"
              onClick={(e) => {
                e.stopPropagation();
                exportGuestDirectory();
              }}
              style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "4px 9px", fontSize: "11px" }}
              title="Download Excel CSV"
            >
              <Download size={12} />
              Excel / CSV
            </button>
          </div>
        </div>

        {/* Card 4: Department Scorecard */}
        <div
          className="panel"
          style={{
            padding: "18px 20px",
            border: activeTab === "scorecard" ? "2px solid var(--ink)" : "1px solid var(--line)",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onClick={() => setActiveTab("scorecard")}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
            <span className="eyebrow" style={{ margin: 0 }}>Executive KPI</span>
            <BarChart3 size={16} strokeWidth={1.75} style={{ color: "var(--muted)" }} />
          </div>
          <h3 style={{ fontSize: "16px", margin: "4px 0" }}>Department Scorecard</h3>
          <p style={{ fontSize: "12px", color: "var(--muted)", margin: "0 0 14px", lineHeight: "1.4" }}>
            Satisfaction scores, review volumes, and recovery rates broken down by department.
          </p>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", fontWeight: 600 }}>6 departments</span>
            <button
              className="button button-dark compact"
              onClick={(e) => {
                e.stopPropagation();
                exportScorecard();
              }}
              style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "4px 9px", fontSize: "11px" }}
              title="Download Excel CSV"
            >
              <Download size={12} />
              Excel / CSV
            </button>
          </div>
        </div>
      </div>

      {/* Filter / Scope Summary Badge */}
      <div
        className="panel"
        style={{
          padding: "12px 18px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          background: "#f9faf8",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}>
            <Building2 size={13} style={{ color: "var(--muted)" }} />
            <span>Property Scope:</span>
            <strong>{activePropertyLabel}</strong>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}>
            <FileText size={13} style={{ color: "var(--muted)" }} />
            <span>Date Range:</span>
            <strong>
              {dateFilter.preset === "all"
                ? "All Recorded Time"
                : `${dateFilter.startDate || ""} to ${dateFilter.endDate || ""}`}
            </strong>
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            className="button button-outline compact"
            onClick={() => window.print()}
            style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11px" }}
          >
            <Printer size={13} />
            Print / PDF Audit
          </button>
          {activeTab === "feedback" && (
            <button
              className="button button-dark compact"
              onClick={exportDatewiseFeedback}
              style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11px" }}
            >
              <Download size={13} />
              Export Feedback CSV
            </button>
          )}
          {activeTab === "complaints" && (
            <button
              className="button button-dark compact"
              onClick={exportComplaints}
              style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11px" }}
            >
              <Download size={13} />
              Export Complaints CSV
            </button>
          )}
          {activeTab === "directory" && (
            <button
              className="button button-dark compact"
              onClick={exportGuestDirectory}
              style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11px" }}
            >
              <Download size={13} />
              Export Directory CSV
            </button>
          )}
          {activeTab === "scorecard" && (
            <button
              className="button button-dark compact"
              onClick={exportScorecard}
              style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11px" }}
            >
              <Download size={13} />
              Export Scorecard CSV
            </button>
          )}
        </div>
      </div>

      {/* Live Preview Table */}
      <section className="panel table-panel">
        <div className="panel-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2>
              {activeTab === "feedback"
                ? "Date-wise guest feedback records"
                : activeTab === "complaints"
                ? "Complaints & service recovery audit"
                : activeTab === "directory"
                ? "Guest directory records"
                : "Departmental performance scorecard"}
            </h2>
            <p>Interactive table preview of records included in the exported report</p>
          </div>
          {activeTab !== "scorecard" && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                className="compact-input"
                placeholder="Search report…"
                value={reportSearch}
                onChange={(e) => setReportSearch(e.target.value)}
                style={{ width: "220px" }}
              />
            </div>
          )}
        </div>

        <div className="table-wrap">
          {activeTab === "feedback" && (
            <table>
              <thead>
                <tr>
                  <th>Guest</th>
                  <th>Room</th>
                  <th>Department</th>
                  <th>Rating</th>
                  <th>Status</th>
                  <th>Comments</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {displayedFeedback.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "28px", color: "var(--muted)" }}>
                      No feedback records found for this date range or search.
                    </td>
                  </tr>
                ) : (
                  displayedFeedback.map((f) => (
                    <tr key={f.id}>
                      <td>
                        <strong>{f.name}</strong>
                      </td>
                      <td>
                        <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: "12px" }}>{f.roomNumber}</span>
                      </td>
                      <td>{f.department}</td>
                      <td>
                        <span className={`status ${f.tone}`}>{f.rating} / 5</span>
                      </td>
                      <td>
                        <span style={{ fontSize: "11px", color: "var(--muted)" }}>{f.statusLabel}</span>
                      </td>
                      <td style={{ maxWidth: "260px" }}>
                        <span style={{ fontSize: "12px", color: f.comment ? "var(--ink)" : "var(--muted)" }}>
                          {f.comment || "No written comment"}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: "11px", color: "var(--muted)", whiteSpace: "nowrap" }}>
                          {new Date(f.createdAt).toLocaleDateString()}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {activeTab === "complaints" && (
            <table>
              <thead>
                <tr>
                  <th>Guest</th>
                  <th>Room</th>
                  <th>Department</th>
                  <th>Rating</th>
                  <th>Issue / Comment</th>
                  <th>Recovery Assignee</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {displayedComplaints.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: "28px", color: "var(--muted)" }}>
                      No complaint records found for this date range.
                    </td>
                  </tr>
                ) : (
                  displayedComplaints.map((f) => (
                    <tr key={f.id}>
                      <td>
                        <strong>{f.name}</strong>
                      </td>
                      <td>
                        <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: "12px" }}>{f.roomNumber}</span>
                      </td>
                      <td>{f.department}</td>
                      <td>
                        <span className="status critical">{f.rating} / 5</span>
                      </td>
                      <td style={{ maxWidth: "280px" }}>
                        <span style={{ fontSize: "12px" }}>{f.comment || f.detail || "Direct complaint logged"}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: "11px", color: "var(--ink-light)" }}>
                          {f.assignedTo || "Unassigned"}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: "11px", color: "var(--muted)" }}>{f.statusLabel}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: "11px", color: "var(--muted)", whiteSpace: "nowrap" }}>
                          {new Date(f.createdAt).toLocaleDateString()}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {activeTab === "directory" && (
            <table>
              <thead>
                <tr>
                  <th>Guest Name</th>
                  <th>Room</th>
                  <th>Contact Email</th>
                  <th>Phone Number</th>
                  <th>Last Score</th>
                  <th>Department</th>
                  <th>Last Visit</th>
                </tr>
              </thead>
              <tbody>
                {displayedGuests.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "28px", color: "var(--muted)" }}>
                      No guest directory profiles found for this date range.
                    </td>
                  </tr>
                ) : (
                  displayedGuests.map((g) => (
                    <tr key={g.id}>
                      <td>
                        <strong>{g.name}</strong>
                      </td>
                      <td>
                        <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: "12px" }}>{g.roomNumber}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: "11px", fontFamily: "var(--font-dm-mono)", color: "var(--ink-light)" }}>
                          {g.guestEmail || "—"}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: "11px", fontFamily: "var(--font-dm-mono)", color: "var(--ink-light)" }}>
                          {g.guestPhone || "—"}
                        </span>
                      </td>
                      <td>
                        <span className={`status ${g.tone}`}>{g.rating} / 5</span>
                      </td>
                      <td>{g.department}</td>
                      <td>
                        <span style={{ fontSize: "11px", color: "var(--muted)", whiteSpace: "nowrap" }}>
                          {new Date(g.createdAt).toLocaleDateString()}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {activeTab === "scorecard" && (
            <table>
              <thead>
                <tr>
                  <th>Operational Department</th>
                  <th>Total Feedback Recorded</th>
                  <th>Average Rating</th>
                  <th>Complaint Incidents</th>
                  <th>Service Satisfaction Rate</th>
                </tr>
              </thead>
              <tbody>
                {departmentScorecard.map((s) => (
                  <tr key={s.department}>
                    <td>
                      <strong>{s.department}</strong>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600 }}>{s.total}</span> responses
                    </td>
                    <td>
                      <span className="status" style={{ background: "#edf4ed", color: "#1c3825" }}>
                        {s.avgRating} / 5.0
                      </span>
                    </td>
                    <td>
                      <span style={{ color: s.complaintCount > 0 ? "#8b261a" : "var(--muted)" }}>
                        {s.complaintCount}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div style={{ width: "90px", height: "6px", background: "var(--line)", borderRadius: "3px", overflow: "hidden" }}>
                          <div style={{ width: `${s.recoveryRate}%`, height: "100%", background: "#254230" }} />
                        </div>
                        <span style={{ fontSize: "11px", fontWeight: 600 }}>{s.recoveryRate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}