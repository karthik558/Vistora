"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { AppShell, FeedbackTable } from "./Dashboard";
import { DashboardData } from "../types/experience";

export default function OperationsPage({ section, data }: { section: string; data: DashboardData }) {
  const [query, setQuery] = useState("");
  const feedback = useMemo(
    () =>
      data.recentFeedback
        .filter((item) => section !== "complaints" || item.rating <= 2 || item.status === "needs_attention")
        .filter((item) => !query || `${item.name} ${item.roomNumber} ${item.department} ${item.comment || ""}`.toLowerCase().includes(query.toLowerCase())),
    [data.recentFeedback, query, section]
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
            <button className="button button-dark compact" onClick={() => downloadCsv(data)}>
              Download CSV ↧
            </button>
          )}
        </div>

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
              />
              <span className="toolbar-count">{feedback.length} records</span>
            </div>
            <FeedbackTable
              feedback={feedback}
              title={section === "complaints" ? "Open recovery queue" : "Feedback records"}
            />
          </>
        )}
      </div>
    </AppShell>
  );
}

function Analytics({ data }: { data: DashboardData }) {
  return (
    <>
      <section className="metric-grid">
        <div className="metric-card">
          <span className="metric-label">Average rating</span>
          <div className="metric-value">
            {data.metrics.averageRating.value}
            <small>/ 5</small>
          </div>
          <div className="metric-change">Across {data.ratingDistribution.totalCount} responses</div>
        </div>
        <div className="metric-card">
          <span className="metric-label">Satisfaction rate</span>
          <div className="metric-value">
            {data.metrics.satisfactionRate.value}
            <small>%</small>
          </div>
          <div className="metric-change">4 and 5 star responses</div>
        </div>
        <div className="metric-card">
          <span className="metric-label">Open complaints</span>
          <div className="metric-value">{data.metrics.openComplaints.value}</div>
          <div className="metric-change">Require follow-up</div>
        </div>
        <div className="metric-card">
          <span className="metric-label">Properties</span>
          <div className="metric-value">{data.properties.length}</div>
          <div className="metric-change">Connected properties</div>
        </div>
      </section>

      <div className="panel analytics-panel">
        <div className="panel-heading">
          <div>
            <h2>Rating distribution</h2>
            <p>Response volume by rating</p>
          </div>
        </div>
        <div className="rating-bars analytics-bars">
          {data.ratingDistribution.bars.map((bar) => (
            <div className="bar-row" key={bar.stars}>
              <span>{bar.stars} stars</span>
              <div className="bar-track">
                <i style={{ width: bar.percentage }} />
              </div>
              <strong>
                {bar.count} <small>{bar.percentage}</small>
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
          {Array.from(new Set(data.recentFeedback.map((item) => item.department))).map((department) => (
            <div className="department-stat" key={department}>
              <strong>{department}</strong>
              <span>
                {data.recentFeedback.filter((item) => item.department === department).length} responses
              </span>
            </div>
          ))}
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
          >
            Download QR PNG ↧
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
        <button className="button button-dark compact" onClick={() => downloadCsv(data)}>
          Download CSV ↧
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