"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  getDashboardData,
  updateFeedbackStatus,
} from "../lib/services/guestExperienceService";
import { isSupabaseConfigured } from "../lib/supabase/client";
import {
  DashboardData,
  FeedbackViewModel,
} from "../types/experience";
import { FeedbackStatus } from "../types/database";

function Icon({
  name,
}: {
  name:
    | "grid"
    | "inbox"
    | "chart"
    | "form"
    | "qr"
    | "report"
    | "users"
    | "settings"
    | "bell"
    | "search"
    | "arrow"
    | "more"
    | "check"
    | "download"
    | "database";
}) {
  const paths: Record<string, string> = {
    grid: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
    inbox: "M4 5h16v14H4zM4 14h5l2 3h2l2-3h5",
    chart: "M5 19V9M12 19V5M19 19v-7",
    form: "M5 4h14v16H5zM8 8h8M8 12h8M8 16h5",
    qr: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h3v3h-3zM19 19h1",
    report: "M5 4h14v16H5zM8 8h8M8 12h8M8 16h4",
    users: "M16 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM20 20v-2a4 4 0 0 0-3-3.87M16 2.13a4 4 0 0 1 0 7.75",
    settings:
      "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.5 1.5-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.02 1.56v.09h-2.12v-.09a1.7 1.7 0 0 0-1.02-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-1.5-1.5.06-.06A1.7 1.7 0 0 0 9.2 15a1.7 1.7 0 0 0-1.56-1.02h-.09v-2.12h.09A1.7 1.7 0 0 0 9.2 10.84a1.7 1.7 0 0 0-.34-1.88l-.06-.06 1.5-1.5.06.06a1.7 1.7 0 0 0 1.88.34A1.7 1.7 0 0 0 13.26 6.24v-.09h2.12v.09a1.7 1.7 0 0 0 1.02 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06 1.5 1.5-.06.06A1.7 1.7 0 0 0 19.4 10.84a1.7 1.7 0 0 0 1.56 1.02h.09v2.12h-.09A1.7 1.7 0 0 0 19.4 15",
    bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4",
    search: "m21 21-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15",
    arrow: "M5 12h14M13 6l6 6-6 6",
    more: "M5 12h.01M12 12h.01M19 12h.01",
    check: "M20 6 9 17l-5-5",
    download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
    database: "M3 5c0 1.66 4.03 3 9 3s9-1.34 9-3-4.03-3-9-3-9 1.34-9 3M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3M3 19c0 1.66 4.03 3 9 3s9-1.34 9-3",
  };
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.grid} />
    </svg>
  );
}

export default function Dashboard() {
  const [activeNav, setActiveNav] = useState("Dashboard");
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("all");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | "all">("all");

  // Detail Modal / Resolution Drawer
  const [activeFeedback, setActiveFeedback] = useState<FeedbackViewModel | null>(null);
  const [resolutionNoteInput, setResolutionNoteInput] = useState("");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Load real data from service
  const loadData = async (propertyId: string) => {
    try {
      const result = await getDashboardData(propertyId);
      setData(result);
    } catch (err) {
      console.error("Error loading dashboard data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(selectedPropertyId);
  }, [selectedPropertyId]);

  // Sidebar navigation sections
  const nav = [
    {
      label: "Overview",
      items: [
        ["Dashboard", "grid"],
        ["Analytics", "chart"],
      ],
    },
    {
      label: "Guest experience",
      items: [
        ["All feedback", "inbox"],
        ["Complaints", "inbox"],
        ["Guest directory", "users"],
      ],
    },
    {
      label: "Collection",
      items: [
        ["Feedback forms", "form"],
        ["QR codes", "qr"],
        ["Campaigns", "chart"],
      ],
    },
    {
      label: "Reporting",
      items: [["Reports", "report"]],
    },
  ];

  // Filtered feedback list
  const filteredFeedback = useMemo(() => {
    if (!data) return [];
    let list = data.recentFeedback;

    if (activeNav === "Complaints") {
      list = list.filter((item) => item.rating <= 2 || item.status === "needs_attention");
    }

    if (statusFilter !== "all") {
      list = list.filter((item) => item.status === statusFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.roomNumber.toLowerCase().includes(q) ||
          item.department.toLowerCase().includes(q) ||
          (item.comment && item.comment.toLowerCase().includes(q))
      );
    }
    return list;
  }, [data, activeNav, statusFilter, searchQuery]);

  // Handle status update
  const handleUpdateStatus = async (newStatus: FeedbackStatus) => {
    if (!activeFeedback) return;
    setIsUpdatingStatus(true);
    try {
      const updated = await updateFeedbackStatus(activeFeedback.id, newStatus, resolutionNoteInput);
      if (updated) {
        setActiveFeedback(updated);
        await loadData(selectedPropertyId);
      }
    } catch (err) {
      console.error("Failed to update status", err);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (!data || data.recentFeedback.length === 0) return;
    const headers = ["ID", "Guest Name", "Room", "Department", "Rating", "Status", "Comment", "Created At"];
    const rows = data.recentFeedback.map((f) => [
      `"${f.id}"`,
      `"${f.name}"`,
      `"${f.roomNumber}"`,
      `"${f.department}"`,
      f.rating,
      `"${f.status}"`,
      `"${(f.comment || "").replace(/"/g, '""')}"`,
      `"${f.createdAt}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `vistora_guest_feedback_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const complaintsCount = data ? Number(data.metrics.openComplaints.value) : 0;

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">V</div>
          <span>vistora</span>
        </div>

        <div className="workspace">
          <span className="workspace-avatar">A</span>
          <div>
            <strong>Anantara Hotels</strong>
            <small>Operations Workspace</small>
          </div>
          <span className="chevron">⌄</span>
        </div>

        <nav>
          {nav.map((group) => (
            <div className="nav-group" key={group.label}>
              <p>{group.label}</p>
              {group.items.map(([label, icon]) => (
                <button
                  key={label}
                  className={`nav-item ${activeNav === label ? "active" : ""}`}
                  onClick={() => {
                    setActiveNav(label);
                    if (label === "Complaints") {
                      setStatusFilter("needs_attention");
                    } else if (label === "All feedback" || label === "Dashboard") {
                      setStatusFilter("all");
                    }
                  }}
                >
                  <Icon name={icon as "grid"} />
                  {label}
                  {label === "Complaints" && complaintsCount > 0 && (
                    <span className="nav-count">{complaintsCount}</span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div style={{ padding: "0 10px 14px" }}>
            <span className="badge-supabase">
              <i className="dot" />
              {isSupabaseConfigured ? "Supabase Connected" : "Supabase Ready"}
            </span>
          </div>
          <button className="nav-item">
            <Icon name="settings" />
            Settings
          </button>
          <div className="user-row">
            <span className="user-avatar">RM</span>
            <div>
              <strong>Rhea Menon</strong>
              <small>General Manager</small>
            </div>
            <Icon name="more" />
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>Workspace</span>
            <b>/</b>
            <strong>{activeNav}</strong>
          </div>
          <div className="top-actions">
            <Link
              href="/feedback/demo-stay"
              target="_blank"
              className="text-link"
              style={{ fontSize: "11px", fontWeight: 500 }}
            >
              Preview Guest Form ↗
            </Link>
            <button className="icon-button" aria-label="Search" onClick={() => document.getElementById("feedback-search")?.focus()}>
              <Icon name="search" />
            </button>
            <button className="icon-button notification" aria-label="Notifications">
              <Icon name="bell" />
              {complaintsCount > 0 && <i />}
            </button>
            <span className="top-avatar">RM</span>
          </div>
        </header>

        <div className="content-wrap">
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                {new Date().toLocaleDateString("en-US", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
              <h1>Good morning, Rhea</h1>
              <p className="subheading">Here’s what’s happening across your guest experience today.</p>
            </div>

            <div className="heading-actions">
              {/* Real Property Switcher */}
              <select
                className="select-button"
                value={selectedPropertyId}
                onChange={(e) => setSelectedPropertyId(e.target.value)}
                style={{ cursor: "pointer", outline: "none" }}
              >
                <option value="all">All properties (3)</option>
                {data?.properties.map((prop) => (
                  <option key={prop.id} value={prop.id}>
                    {prop.name}
                  </option>
                ))}
              </select>

              <button className="button button-dark compact" onClick={handleExportCSV}>
                Export CSV <Icon name="download" />
              </button>
            </div>
          </div>

          {/* Database Banner / Architecture Indicator */}
          <div className="demo-banner">
            <span className="pulse-dot" />
            <strong>{isSupabaseConfigured ? "Supabase Live Database" : "Supabase-Ready Schema Active"}</strong>
            <span>
              {isSupabaseConfigured
                ? "Streaming live guest experience records directly from Supabase PostgreSQL tables."
                : "Using validated schema & local persistence. Add credentials to .env.local to link your Supabase project."}
            </span>
            <Link href="/feedback/demo-stay" style={{ marginLeft: "auto", color: "#456150", fontWeight: 600, fontSize: "11px" }}>
              Test Guest Feedback Flow →
            </Link>
          </div>

          {/* Dynamic Metrics */}
          {data && (
            <section className="metric-grid">
              <Metric
                label={data.metrics.feedbackReceived.label}
                value={data.metrics.feedbackReceived.value}
                change={data.metrics.feedbackReceived.change}
                note={data.metrics.feedbackReceived.note}
              />
              <Metric
                label={data.metrics.averageRating.label}
                value={data.metrics.averageRating.value}
                suffix={data.metrics.averageRating.suffix}
                change={data.metrics.averageRating.change}
                note={data.metrics.averageRating.note}
              />
              <Metric
                label={data.metrics.satisfactionRate.label}
                value={data.metrics.satisfactionRate.value}
                suffix={data.metrics.satisfactionRate.suffix}
                change={data.metrics.satisfactionRate.change}
                note={data.metrics.satisfactionRate.note}
              />
              <Metric
                label={data.metrics.openComplaints.label}
                value={data.metrics.openComplaints.value}
                change={data.metrics.openComplaints.change}
                note={data.metrics.openComplaints.note}
                negative={data.metrics.openComplaints.negative}
              />
            </section>
          )}

          {/* Upper Dashboard Grid: Trend + Rating Distribution */}
          {data && (
            <section className="dashboard-grid">
              <div className="panel trend-panel">
                <PanelHeading
                  title="Feedback trend"
                  detail="Submissions across all departments"
                  action="Last 30 days"
                />
                <div className="chart-legend">
                  <span>
                    <i className="legend-line" />
                    Submissions
                  </span>
                  <span>
                    <i className="legend-line soft" />
                    Target baseline
                  </span>
                </div>
                <div className="line-chart">
                  <div className="y-labels">
                    <span>80</span>
                    <span>60</span>
                    <span>40</span>
                    <span>20</span>
                    <span>0</span>
                  </div>
                  <div className="chart-area">
                    <div className="grid-lines">
                      <i />
                      <i />
                      <i />
                      <i />
                      <i />
                    </div>
                    <svg viewBox="0 0 700 220" preserveAspectRatio="none" aria-label="Feedback trend chart">
                      <path
                        className="previous-line"
                        d="M0 171 C60 155 74 176 120 148 S188 124 230 151 S295 130 345 142 S407 97 458 120 S514 95 558 104 S624 76 700 89"
                      />
                      <path
                        className="trend-line"
                        d="M0 158 C47 148 66 110 112 129 S174 148 214 113 S278 87 324 108 S388 118 420 82 S482 55 523 76 S576 77 617 47 S664 62 700 30"
                      />
                      <circle cx="617" cy="47" r="4" />
                    </svg>
                    <div className="x-labels">
                      <span>May 20</span>
                      <span>May 27</span>
                      <span>Jun 03</span>
                      <span>Jun 10</span>
                      <span>Today</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Real Computed Rating Distribution */}
              <div className="panel rating-panel">
                <PanelHeading
                  title="Rating distribution"
                  detail={`All ${data.ratingDistribution.totalCount} submitted ratings`}
                  action="View details"
                />
                <div className="rating-bars">
                  {data.ratingDistribution.bars.map((item) => (
                    <div className="bar-row" key={item.stars}>
                      <span>{item.stars}</span>
                      <div className="bar-track">
                        <i style={{ width: item.percentage }} />
                      </div>
                      <strong>{item.count}</strong>
                    </div>
                  ))}
                </div>
                <div className="rating-total">
                  <span>Overall average</span>
                  <strong>
                    {data.ratingDistribution.average} <small>/ 5</small>
                  </strong>
                </div>
              </div>
            </section>
          )}

          {/* Lower Grid: Real Feedback Table + Attention Items */}
          <section className="lower-grid">
            <div className="panel table-panel">
              <PanelHeading
                title={activeNav === "Complaints" ? "Service Recovery & Complaints" : "Recent feedback"}
                detail="Operational guest submissions with live recovery status"
                action={`Showing ${filteredFeedback.length} items`}
              />

              {/* Table Toolbar: Search and Filter Chips */}
              <div className="table-toolbar">
                <div className="search-input-wrap">
                  <span className="search-icon">
                    <Icon name="search" />
                  </span>
                  <input
                    id="feedback-search"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by guest, room, department…"
                  />
                </div>

                <div className="filter-tabs">
                  <button
                    className={`filter-tab ${statusFilter === "all" ? "active" : ""}`}
                    onClick={() => setStatusFilter("all")}
                  >
                    All ({data?.recentFeedback.length || 0})
                  </button>
                  <button
                    className={`filter-tab ${statusFilter === "needs_attention" ? "active" : ""}`}
                    onClick={() => setStatusFilter("needs_attention")}
                  >
                    Needs attention
                  </button>
                  <button
                    className={`filter-tab ${statusFilter === "under_review" ? "active" : ""}`}
                    onClick={() => setStatusFilter("under_review")}
                  >
                    Under review
                  </button>
                  <button
                    className={`filter-tab ${statusFilter === "resolved" ? "active" : ""}`}
                    onClick={() => setStatusFilter("resolved")}
                  >
                    Resolved
                  </button>
                </div>
              </div>

              {/* Table Body */}
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Guest</th>
                      <th>Experience</th>
                      <th>Rating</th>
                      <th>Status</th>
                      <th>Received</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFeedback.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: "center", padding: "32px", color: "#8a948e" }}>
                          No feedback entries found matching your filters.
                        </td>
                      </tr>
                    ) : (
                      filteredFeedback.map((item) => (
                        <tr
                          key={item.id}
                          className="clickable-row"
                          onClick={() => {
                            setActiveFeedback(item);
                            setResolutionNoteInput(item.resolutionNotes || "");
                          }}
                        >
                          <td>
                            <div className="guest-cell">
                              <span className={`mini-avatar ${item.tone}`}>{item.initials}</span>
                              <div>
                                <strong>{item.name}</strong>
                                {item.wantsContact && (
                                  <small style={{ display: "block", color: "#b16b5d", fontSize: "9px" }}>
                                    Follow-up requested
                                  </small>
                                )}
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="muted">{item.detail}</span>
                          </td>
                          <td>
                            <span className="table-rating">
                              {item.rating}
                              <b> / 5</b>
                            </span>
                          </td>
                          <td>
                            <span className={`status ${item.tone}`}>{item.statusLabel}</span>
                          </td>
                          <td>
                            <span className="muted">{item.timeAgo}</span>
                          </td>
                          <td>
                            <button
                              className="more-button"
                              aria-label={`View feedback for ${item.name}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveFeedback(item);
                                setResolutionNoteInput(item.resolutionNotes || "");
                              }}
                            >
                              <Icon name="more" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Real Attention Required Panel */}
            <div className="panel attention-panel">
              <PanelHeading
                title="Attention required"
                detail="Critical complaints and active follow-up SLAs"
                action="View all"
              />
              <div className="attention-list">
                {data?.attentionItems.length === 0 ? (
                  <p style={{ padding: "20px", color: "#8a948e", fontSize: "11px", margin: 0 }}>
                    No outstanding guest complaints. All service recovery SLAs are met.
                  </p>
                ) : (
                  data?.attentionItems.map((att) => (
                    <div
                      key={att.id}
                      className="attention-item clickable-row"
                      onClick={() => {
                        if (att.feedbackId) {
                          const target = data.recentFeedback.find((f) => f.id === att.feedbackId);
                          if (target) {
                            setActiveFeedback(target);
                            setResolutionNoteInput(target.resolutionNotes || "");
                          }
                        }
                      }}
                    >
                      <i className={`attention-mark ${att.type}`} />
                      <div>
                        <strong>{att.title}</strong>
                        <p>{att.detail}</p>
                        <small>{att.meta}</small>
                      </div>
                      <span>→</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Guest Feedback Detail & Service Recovery Modal */}
      {activeFeedback && (
        <div className="modal-backdrop" onClick={() => setActiveFeedback(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">{activeFeedback.department} · {activeFeedback.roomNumber}</p>
                <h2 style={{ margin: "4px 0", fontSize: "18px", fontWeight: 600 }}>
                  {activeFeedback.name}
                </h2>
                <span className={`status ${activeFeedback.tone}`}>
                  {activeFeedback.statusLabel}
                </span>
              </div>
              <button className="modal-close" onClick={() => setActiveFeedback(null)}>
                ×
              </button>
            </div>

            <div style={{ margin: "16px 0", padding: "14px", background: "#f8faf8", borderRadius: "4px", border: "1px solid #e7ece7" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink)" }}>Guest Rating</span>
                <span className="table-rating" style={{ fontSize: "14px" }}>
                  <strong>{activeFeedback.rating}</strong> / 5
                </span>
              </div>
              <p style={{ margin: "0", fontSize: "12px", color: "#445248", lineHeight: 1.6 }}>
                "{activeFeedback.comment || "No written comment provided."}"
              </p>
            </div>

            {activeFeedback.wantsContact && (
              <div style={{ margin: "12px 0", padding: "12px", background: "#fcf6f4", border: "1px solid #f0dfdb", borderRadius: "4px", fontSize: "11px" }}>
                <strong style={{ color: "#9f594b", display: "block", marginBottom: "4px" }}>
                  Guest requested manager contact
                </strong>
                <span style={{ color: "#6e7570" }}>
                  Channel: {activeFeedback.contactPreference || "Email"} ·{" "}
                  {activeFeedback.guestEmail || activeFeedback.guestPhone || "Contact details on stay profile"}
                </span>
              </div>
            )}

            <div style={{ marginTop: "18px" }}>
              <label className="field-label" htmlFor="resolution-notes">
                Service Recovery & Operations Notes
              </label>
              <textarea
                id="resolution-notes"
                value={resolutionNoteInput}
                onChange={(e) => setResolutionNoteInput(e.target.value)}
                placeholder="Log manager actions, guest communications, compensation or staff commendations…"
                rows={3}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "4px",
                  border: "1px solid #d9dfd9",
                  fontSize: "12px",
                  outline: "none",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "20px", gap: "10px", flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  className="quick-action-btn"
                  disabled={isUpdatingStatus}
                  onClick={() => handleUpdateStatus("needs_attention")}
                >
                  Flag as Urgent
                </button>
                <button
                  className="quick-action-btn"
                  disabled={isUpdatingStatus}
                  onClick={() => handleUpdateStatus("under_review")}
                >
                  Mark Under Review
                </button>
                <button
                  className="button button-dark compact"
                  disabled={isUpdatingStatus}
                  onClick={() => handleUpdateStatus("resolved")}
                >
                  <Icon name="check" /> Mark Resolved
                </button>
              </div>

              <button
                className="select-button"
                onClick={() => setActiveFeedback(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  suffix,
  change,
  note,
  negative,
}: {
  label: string;
  value: string;
  suffix?: string;
  change: string;
  note: string;
  negative?: boolean;
}) {
  return (
    <div className="metric-card">
      <span className="metric-label">{label}</span>
      <div className="metric-value">
        {value}
        <small>{suffix}</small>
      </div>
      <div className={`metric-change ${negative ? "negative" : ""}`}>
        <span>{negative ? "↑" : "↗"} {change}</span>
        <small>{note}</small>
      </div>
    </div>
  );
}

function PanelHeading({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action: string;
}) {
  return (
    <div className="panel-heading">
      <div>
        <h2>{title}</h2>
        <p>{detail}</p>
      </div>
      <button className="panel-action">
        {action} <span>⌄</span>
      </button>
    </div>
  );
}