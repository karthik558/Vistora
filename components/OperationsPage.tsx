"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { motion } from "framer-motion";
import { Download } from "lucide-react";
import { AppShell, FeedbackTable } from "./Dashboard";
import { DashboardData } from "../types/experience";
import CustomDatePicker, { DateRangeFilter, isDateInRange } from "./CustomDatePicker";
import PropertyFilter from "./PropertyFilter";

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
    forms: "Manage the public form guests use to share feedback.",
    "qr-codes": "Create trackable QR codes for rooms, departments, and guest touchpoints.",
    reports: "Export operational records for reviews and follow-up.",
  };

  return (
    <AppShell active={title} complaints={Number(data.metrics.openComplaints.value)}>
      <div className="content-wrap">
        <div className="page-heading">
          <div>
            <p className="eyebrow">Guest experience operations</p>
            <h1>{title}</h1>
            <p className="subheading">{descriptions[section]}</p>
          </div>
          {section === "reports" && (
            <button
              className="button button-dark compact"
              onClick={() => downloadCsv(data)}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <Download size={13} />
              <span>Download CSV</span>
            </button>
          )}
        </div>

        <motion.div
          key={section}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
        >
          {section === "analytics" ? (
            <Analytics data={data} />
          ) : section === "directory" ? (
            <Directory data={data} query={query} setQuery={setQuery} />
          ) : section === "forms" ? (
            <Forms />
          ) : section === "qr-codes" ? (
            <QrCodes />
          ) : section === "reports" ? (
            <Reports data={data} />
          ) : (
            <>
              <div className="table-toolbar page-toolbar">
                <input
                  className="auth-input"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search guest, room, department, or comment…"
                  style={{ minWidth: "220px", flex: 1 }}
                />
                <PropertyFilter
                  properties={data.properties}
                  selectedId={selectedProperty}
                  onChange={setSelectedProperty}
                />
                <CustomDatePicker
                  value={dateFilter}
                  onChange={setDateFilter}
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

function Analytics({ data }: { data: DashboardData }) {
  const [selectedProperty, setSelectedProperty] = useState<string | "all">("all");
  const [dateFilter, setDateFilter] = useState<DateRangeFilter>({
    preset: "all",
    startDate: null,
    endDate: null,
  });

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
      <div className="filter-controls-row">
        <PropertyFilter
          properties={data.properties}
          selectedId={selectedProperty}
          onChange={setSelectedProperty}
        />
        <CustomDatePicker
          value={dateFilter}
          onChange={setDateFilter}
        />
      </div>

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
          <li>1–5 guest rating</li>
          <li>Department and room context</li>
          <li>Written feedback</li>
          <li>Optional contact request</li>
        </ul>
      </div>
    </div>
  );
}

function QrCodes() {
  const [label, setLabel] = useState("Lobby feedback");
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  const url =
    typeof window === "undefined"
      ? "https://vistora.app/feedback"
      : `${window.location.origin}/feedback`;

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
    link.download = `vistora-qr-${label.toLowerCase().replace(/[^a-z0-9]/g, "-")}.png`;
    link.click();
  }

  return (
    <div className="qr-layout">
      <div className="panel qr-card">
        <p className="eyebrow">Create a trackable touchpoint</p>
        <h2>Guest feedback QR code</h2>
        <p>Use this QR code on room key cards, tent cards, or service recovery follow-up notes.</p>

        <label className="field-label">
          Placement Label
          <input className="auth-input" value={label} onChange={(event) => setLabel(event.target.value)} />
        </label>

        <label className="field-label">
          Target Link
          <input className="auth-input" value={url} readOnly />
        </label>

        <div style={{ display: "flex", gap: "10px", marginTop: "18px" }}>
          <button
            type="button"
            className="button button-dark"
            onClick={async () => {
              await navigator.clipboard?.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? "Link copied!" : "Copy link"}
          </button>
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
            style={{ width: "190px", height: "190px", borderRadius: "8px", border: "1px solid var(--line)", background: "#fff", padding: "8px", boxShadow: "var(--shadow-xs)" }}
          />
        ) : (
          <div style={{ width: "190px", height: "190px", display: "grid", placeItems: "center", border: "1px solid var(--line)", borderRadius: "8px" }}>
            Generating QR…
          </div>
        )}
        <strong style={{ marginTop: "16px", fontSize: "13px" }}>{label}</strong>
        <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: "11px" }}>Scan with camera to open guest feedback</p>
      </div>
    </div>
  );
}

function Reports({ data }: { data: DashboardData }) {
  return (
    <div className="report-grid">
      <div className="panel report-card">
        <span className="eyebrow">Operational export</span>
        <h2>Guest feedback report</h2>
        <p>Download a CSV containing guest, room, department, rating, status, comments, and timestamps.</p>
        <button
          className="button button-dark compact"
          onClick={() => downloadCsv(data)}
          style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
        >
          <Download size={13} />
          <span>Download CSV</span>
        </button>
      </div>
      <div className="panel report-card">
        <span className="eyebrow">Verified records</span>
        <h2>Live operational data</h2>
        <p>This report reflects verified operational guest feedback records captured across properties.</p>
        <Link className="panel-action" href="/dashboard/analytics">
          Review analytics ↗
        </Link>
      </div>
    </div>
  );
}

function downloadCsv(data: DashboardData) {
  const headers = ["Guest", "Room", "Department", "Rating", "Status", "Comment", "Created at"];
  const rows = data.recentFeedback.map((item) => [
    item.name,
    item.roomNumber,
    item.department,
    String(item.rating),
    item.statusLabel,
    item.comment || "",
    item.createdAt,
  ]);
  const csv = [headers, ...rows].map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")).join("\n");
  const link = document.createElement("a");
  link.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
  link.download = `vistora-feedback-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
}