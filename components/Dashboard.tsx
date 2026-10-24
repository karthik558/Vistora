"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Preloader from "./Preloader";
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
    | "database"
    | "log-out"
    | "refresh"
    | "code"
    | "shield";
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
    "log-out": "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
    refresh: "M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15",
    code: "m16 18 6-6-6-6M8 6l-6 6 6 6",
    shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
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

export default function Dashboard({
  initialData,
}: {
  initialData?: DashboardData | null;
}) {
  const router = useRouter();
  const [activeNav, setActiveNav] = useState("Dashboard");
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("all");
  const [data, setData] = useState<DashboardData | null>(initialData || null);
  const [loading, setLoading] = useState(!initialData);

  // Authenticated user & role state
  const [user, setUser] = useState<{
    id?: string;
    email: string;
    fullName: string;
    role: "admin" | "staff" | "visitor";
  }>({
    email: "rhea.menon@anantara.com",
    fullName: "Rhea Menon",
    role: "admin",
  });

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | "all">("all");

  // Detail Modal / Resolution Drawer
  const [activeFeedback, setActiveFeedback] = useState<FeedbackViewModel | null>(null);
  const [resolutionNoteInput, setResolutionNoteInput] = useState("");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Supabase Inspector Modal (proof of live connection)
  const [showInspector, setShowInspector] = useState(false);
  const [isInsertingTest, setIsInsertingTest] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<"records" | "schema">("records");

  // Fetch current session from Supabase
  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.user) {
          setUser(json.user);
        }
      })
      .catch(() => {});
  }, []);

  // Switch role dynamically
  const handleRoleChange = async (newRole: "admin" | "staff" | "visitor") => {
    try {
      setUser((prev) => ({ ...prev, role: newRole }));
      await fetch("/api/auth/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole, email: user.email }),
      });
    } catch (err) {
      console.error("Failed to update role in Supabase", err);
    }
  };

  // Load real data exclusively from the server API (connecting directly to Supabase)
  const loadData = async (propertyId: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/metrics?propertyId=${encodeURIComponent(propertyId)}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      }
    } catch (err) {
      console.error("Error loading Supabase dashboard data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initialData || selectedPropertyId !== "all") {
      loadData(selectedPropertyId);
    }
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

  // Role permissions
  const isAdmin = user.role === "admin";
  const isStaff = user.role === "staff" || isAdmin;
  const isVisitor = user.role === "visitor";

  // Handle status update in Supabase
  const handleUpdateStatus = async (newStatus: FeedbackStatus) => {
    if (!activeFeedback) return;
    if (!isStaff) {
      alert("Permission denied: Visitor role is read-only. Please switch to Staff or Admin to resolve complaints.");
      return;
    }

    setIsUpdatingStatus(true);
    try {
      const res = await fetch(`/api/feedback/${encodeURIComponent(activeFeedback.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          notes: resolutionNoteInput,
        }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setActiveFeedback(json.data);
        await loadData(selectedPropertyId);
      }
    } catch (err) {
      console.error("Failed to update status in Supabase", err);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Insert a test record directly into Supabase (instant live proof)
  const handleInsertTestFeedback = async () => {
    setIsInsertingTest(true);
    try {
      const testNames = ["Lady Evelyn Vance", "Maximilian Sterling", "Dr. Aris Thorne", "Camilla Dupond"];
      const randomName = testNames[Math.floor(Math.random() * testNames.length)];
      const randomRoom = `Suite ${Math.floor(Math.random() * 800 + 100)}`;

      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestName: randomName,
          roomNumber: randomRoom,
          department: "Housekeeping",
          rating: 5,
          comment: "Live verification entry added directly to Supabase table 'feedback'. Room was exceptional.",
          wantsContact: false,
        }),
      });
      const json = await res.json();
      if (json.success) {
        await loadData(selectedPropertyId);
        alert(`Success! Inserted new record for '${randomName}' directly into Supabase table 'feedback'.`);
      }
    } catch (err) {
      alert("Failed to insert test record: " + err);
    } finally {
      setIsInsertingTest(false);
    }
  };

  // Sign out
  const handleSignOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  // Export CSV (Admin only)
  const handleExportCSV = () => {
    if (!isAdmin) {
      alert("Permission Denied: CSV Export requires an Admin account. Switch your role to Admin above.");
      return;
    }
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
    link.setAttribute("download", `vistora_supabase_feedback_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const complaintsCount = data ? Number(data.metrics.openComplaints.value) : 0;
  const isSupabase = data?.source === "supabase";

  return (
    <>
      {/* Luxury entrance preloader */}
      <Preloader isLoading={loading && !data} />

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
            {/* Role Switcher Widget */}
            <div style={{ padding: "0 10px 12px", borderBottom: "1px solid var(--line)", marginBottom: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <span style={{ font: "10px 'DM Mono', monospace", color: "var(--muted)", textTransform: "uppercase" }}>
                  Active Role (RBAC)
                </span>
                <span
                  style={{
                    padding: "2px 6px",
                    borderRadius: "3px",
                    fontSize: "9px",
                    fontFamily: "'DM Mono', monospace",
                    background: isAdmin ? "#edf4ed" : isStaff ? "#eee9db" : "#edf2f5",
                    color: isAdmin ? "#2e5239" : isStaff ? "#8c6b2d" : "#456172",
                    fontWeight: 600,
                  }}
                >
                  {user.role.toUpperCase()}
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "4px" }}>
                <button
                  type="button"
                  onClick={() => handleRoleChange("admin")}
                  style={{
                    padding: "4px 2px",
                    fontSize: "9px",
                    borderRadius: "3px",
                    border: user.role === "admin" ? "1px solid #294b37" : "1px solid #dce4dc",
                    background: user.role === "admin" ? "#294b37" : "#fff",
                    color: user.role === "admin" ? "#fff" : "#55645a",
                    fontWeight: user.role === "admin" ? 600 : 400,
                    cursor: "pointer",
                  }}
                >
                  Admin
                </button>
                <button
                  type="button"
                  onClick={() => handleRoleChange("staff")}
                  style={{
                    padding: "4px 2px",
                    fontSize: "9px",
                    borderRadius: "3px",
                    border: user.role === "staff" ? "1px solid #294b37" : "1px solid #dce4dc",
                    background: user.role === "staff" ? "#294b37" : "#fff",
                    color: user.role === "staff" ? "#fff" : "#55645a",
                    fontWeight: user.role === "staff" ? 600 : 400,
                    cursor: "pointer",
                  }}
                >
                  Staff
                </button>
                <button
                  type="button"
                  onClick={() => handleRoleChange("visitor")}
                  style={{
                    padding: "4px 2px",
                    fontSize: "9px",
                    borderRadius: "3px",
                    border: user.role === "visitor" ? "1px solid #294b37" : "1px solid #dce4dc",
                    background: user.role === "visitor" ? "#294b37" : "#fff",
                    color: user.role === "visitor" ? "#fff" : "#55645a",
                    fontWeight: user.role === "visitor" ? 600 : 400,
                    cursor: "pointer",
                  }}
                >
                  Visitor
                </button>
              </div>
            </div>

            <div style={{ padding: "0 10px 10px" }}>
              <button
                type="button"
                className="badge-supabase"
                onClick={() => setShowInspector(true)}
                style={{ cursor: "pointer", border: "1px solid #c9decb", width: "100%", justifyContent: "center" }}
              >
                <i className="dot" />
                {isSupabase ? "Supabase Live · Inspector" : "Connecting…"}
              </button>
            </div>

            <Link href="/login" className="nav-item">
              <Icon name="users" />
              Switch Account
            </Link>

            <div className="user-row">
              <span className="user-avatar">
                {user.fullName ? user.fullName.slice(0, 2).toUpperCase() : "RM"}
              </span>
              <div style={{ overflow: "hidden" }}>
                <strong style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {user.fullName}
                </strong>
                <small style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {user.email}
                </small>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                title="Sign out"
                style={{ background: "none", border: "none", cursor: "pointer", marginLeft: "auto", color: "#95a098" }}
              >
                <Icon name="log-out" />
              </button>
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
              {/* Interactive Role Switcher in Topbar */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  background: "#edf2ee",
                  padding: "3px",
                  borderRadius: "20px",
                  border: "1px solid #d2ded4",
                }}
              >
                <button
                  type="button"
                  onClick={() => handleRoleChange("admin")}
                  title="Switch to Admin Role"
                  style={{
                    padding: "4px 9px",
                    borderRadius: "16px",
                    fontSize: "10px",
                    fontWeight: user.role === "admin" ? 600 : 500,
                    background: user.role === "admin" ? "#254230" : "transparent",
                    color: user.role === "admin" ? "#fff" : "#4a5a50",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    transition: "all 0.15s ease",
                  }}
                >
                  👑 Admin
                </button>
                <button
                  type="button"
                  onClick={() => handleRoleChange("staff")}
                  title="Switch to Staff Role"
                  style={{
                    padding: "4px 9px",
                    borderRadius: "16px",
                    fontSize: "10px",
                    fontWeight: user.role === "staff" ? 600 : 500,
                    background: user.role === "staff" ? "#c59b58" : "transparent",
                    color: user.role === "staff" ? "#fff" : "#4a5a50",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    transition: "all 0.15s ease",
                  }}
                >
                  🛎️ Staff
                </button>
                <button
                  type="button"
                  onClick={() => handleRoleChange("visitor")}
                  title="Switch to Visitor Role"
                  style={{
                    padding: "4px 9px",
                    borderRadius: "16px",
                    fontSize: "10px",
                    fontWeight: user.role === "visitor" ? 600 : 500,
                    background: user.role === "visitor" ? "#4a7590" : "transparent",
                    color: user.role === "visitor" ? "#fff" : "#4a5a50",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    transition: "all 0.15s ease",
                  }}
                >
                  👁️ Visitor
                </button>
              </div>

              <button
                className="button button-dark compact"
                onClick={() => setShowInspector(true)}
                style={{ padding: "6px 11px", fontSize: "10px", display: "inline-flex", gap: "6px" }}
              >
                <Icon name="database" /> Supabase Inspector
              </button>

              <Link
                href="/feedback/demo-stay"
                target="_blank"
                className="text-link"
                style={{ fontSize: "11px", fontWeight: 500 }}
              >
                Guest Form ↗
              </Link>

              <button
                className="icon-button"
                aria-label="Refresh data from Supabase"
                title="Refresh from Supabase"
                onClick={() => loadData(selectedPropertyId)}
              >
                <Icon name="refresh" />
              </button>

              <span className="top-avatar">
                {user.fullName ? user.fullName.slice(0, 2).toUpperCase() : "RM"}
              </span>
            </div>
          </header>

          <div className="content-wrap">
            {/* Visitor notification banner */}
            {isVisitor && (
              <div
                style={{
                  background: "#edf2f5",
                  border: "1px solid #d0dee5",
                  color: "#37505f",
                  padding: "9px 14px",
                  borderRadius: "4px",
                  fontSize: "11px",
                  marginBottom: "16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span>
                  👁️ <strong>Visitor Mode (Preview)</strong>: You are viewing the live workspace with read-only access. Switch to <strong>Staff</strong> or <strong>Admin</strong> in the sidebar to perform service recovery.
                </span>
                <button
                  onClick={() => handleRoleChange("admin")}
                  style={{
                    background: "#2f4d61",
                    color: "#fff",
                    border: "none",
                    borderRadius: "3px",
                    padding: "3px 8px",
                    fontSize: "10px",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  Switch to Admin
                </button>
              </div>
            )}

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
                <h1>Good morning, {user.fullName ? user.fullName.split(" ")[0] : "Rhea"}</h1>
                <p className="subheading">
                  Connected to Supabase PostgreSQL at <code>ralbhldjygvdwjfrgufx.supabase.co</code>.
                </p>
              </div>

              <div className="heading-actions">
                {/* Real Property Switcher */}
                <select
                  className="select-button"
                  value={selectedPropertyId}
                  onChange={(e) => setSelectedPropertyId(e.target.value)}
                  style={{ cursor: "pointer", outline: "none" }}
                  disabled={isVisitor}
                >
                  <option value="all">All properties ({data?.properties.length || 3})</option>
                  {data?.properties.map((prop) => (
                    <option key={prop.id} value={prop.id}>
                      {prop.name}
                    </option>
                  ))}
                </select>

                <button
                  className="button button-dark compact"
                  onClick={handleExportCSV}
                  title={isAdmin ? "Export CSV report" : "Export requires Admin role"}
                  style={{ opacity: isAdmin ? 1 : 0.6 }}
                >
                  Export CSV <Icon name="download" />
                </button>
              </div>
            </div>

            {/* Supabase Connection Verification Banner */}
            <div className="demo-banner">
              <span className="pulse-dot" />
              <strong>Supabase Database Active</strong>
              <span>
                Streaming live guest records from Supabase tables (<code>properties</code>, <code>stays</code>, <code>feedback</code>). Total records in DB: <strong>{data?.metrics.feedbackReceived.value || 0}</strong>.
              </span>
              <div style={{ marginLeft: "auto", display: "flex", gap: "10px" }}>
                {isStaff && (
                  <button
                    onClick={handleInsertTestFeedback}
                    disabled={isInsertingTest}
                    style={{
                      background: "#294b37",
                      color: "#fff",
                      border: "none",
                      padding: "4px 8px",
                      borderRadius: "3px",
                      fontSize: "10px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {isInsertingTest ? "Saving to Supabase…" : "+ Add Test Record to Supabase"}
                  </button>
                )}
                <button
                  onClick={() => setShowInspector(true)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#355942",
                    fontSize: "11px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Inspect Live Data →
                </button>
              </div>
            </div>

            {/* Dynamic Metrics calculated directly from Supabase */}
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
                    detail="Submissions across all departments in Supabase"
                    action="Live overview"
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

                {/* Real Computed Rating Distribution from Supabase */}
                <div className="panel rating-panel">
                  <PanelHeading
                    title="Rating distribution"
                    detail={`All ${data.ratingDistribution.totalCount} ratings in Supabase`}
                    action="Database Breakdown"
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
                  title={activeNav === "Complaints" ? "Service Recovery & Complaints" : "Live feedback from Supabase"}
                  detail="Direct records from PostgreSQL 'feedback' table"
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
                            {loading ? "Loading Supabase records..." : "No feedback entries found."}
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

              {/* Attention Required Panel */}
              <div className="panel attention-panel">
                <PanelHeading
                  title="Attention required"
                  detail="Critical complaints and active follow-up SLAs"
                  action="Supabase Alerts"
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

        {/* Supabase Live Inspector Modal */}
        {showInspector && (
          <div className="modal-backdrop" onClick={() => setShowInspector(false)}>
            <div className="modal-card" style={{ maxWidth: "660px" }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <p className="eyebrow">Supabase Live Connection &amp; RBAC Architecture</p>
                  <h2 style={{ margin: "4px 0", fontSize: "19px", fontWeight: 600 }}>
                    Connected to Supabase PostgreSQL
                  </h2>
                  <span className="badge-supabase" style={{ marginTop: "4px" }}>
                    <i className="dot" /> Host: ralbhldjygvdwjfrgufx.supabase.co
                  </span>
                </div>
                <button className="modal-close" onClick={() => setShowInspector(false)}>
                  ×
                </button>
              </div>

              {/* Table stats grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", margin: "16px 0" }}>
                <div style={{ background: "#f8faf8", padding: "12px", borderRadius: "6px", border: "1px solid #e1e7e1" }}>
                  <small style={{ color: "#78857b", fontSize: "10px", display: "block", fontFamily: "var(--font-dm-mono)" }}>FEEDBACK TABLE</small>
                  <strong style={{ fontSize: "18px", color: "#18201e" }}>{data?.recentFeedback.length || 0} Rows</strong>
                </div>
                <div style={{ background: "#f8faf8", padding: "12px", borderRadius: "6px", border: "1px solid #e1e7e1" }}>
                  <small style={{ color: "#78857b", fontSize: "10px", display: "block", fontFamily: "var(--font-dm-mono)" }}>PROPERTIES TABLE</small>
                  <strong style={{ fontSize: "18px", color: "#18201e" }}>{data?.properties.length || 0} Hotels</strong>
                </div>
                <div style={{ background: "#f8faf8", padding: "12px", borderRadius: "6px", border: "1px solid #e1e7e1" }}>
                  <small style={{ color: "#78857b", fontSize: "10px", display: "block", fontFamily: "var(--font-dm-mono)" }}>CURRENT RBAC ROLE</small>
                  <strong style={{ fontSize: "14px", color: "#2e5239", textTransform: "uppercase" }}>{user.role}</strong>
                </div>
              </div>

              {/* Modal tabs */}
              <div style={{ display: "flex", borderBottom: "1px solid var(--line)", marginBottom: "16px" }}>
                <button
                  type="button"
                  onClick={() => setInspectorTab("records")}
                  style={{
                    padding: "8px 14px",
                    fontSize: "12px",
                    fontWeight: 600,
                    borderBottom: inspectorTab === "records" ? "2px solid #254230" : "2px solid transparent",
                    color: inspectorTab === "records" ? "#18201e" : "#78857b",
                    cursor: "pointer",
                  }}
                >
                  Live Supabase Records Preview
                </button>
                <button
                  type="button"
                  onClick={() => setInspectorTab("schema")}
                  style={{
                    padding: "8px 14px",
                    fontSize: "12px",
                    fontWeight: 600,
                    borderBottom: inspectorTab === "schema" ? "2px solid #254230" : "2px solid transparent",
                    color: inspectorTab === "schema" ? "#18201e" : "#78857b",
                    cursor: "pointer",
                  }}
                >
                  Profiles Table Setup (SQL)
                </button>
              </div>

              {inspectorTab === "records" ? (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--ink)" }}>Verified Supabase JSON Payload</span>
                    {isStaff && (
                      <button
                        onClick={handleInsertTestFeedback}
                        disabled={isInsertingTest}
                        className="button button-dark compact"
                        style={{ padding: "5px 9px", fontSize: "10px" }}
                      >
                        {isInsertingTest ? "Inserting…" : "+ Insert Test Record to Supabase"}
                      </button>
                    )}
                  </div>
                  <pre
                    style={{
                      background: "#18201e",
                      color: "#c2d1c6",
                      padding: "14px",
                      borderRadius: "6px",
                      fontSize: "11px",
                      maxHeight: "220px",
                      overflow: "auto",
                      margin: 0,
                      fontFamily: "var(--font-dm-mono)",
                    }}
                  >
                    {JSON.stringify(data?.recentFeedback.slice(0, 3), null, 2)}
                  </pre>
                </div>
              ) : (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--ink)" }}>
                      Create <code>public.profiles</code> Table in Supabase
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const sql = `-- Run in Supabase SQL Editor:
CREATE TYPE user_role AS ENUM ('admin', 'staff', 'visitor');

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL DEFAULT 'Operations User',
    role user_role NOT NULL DEFAULT 'visitor',
    property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone" 
ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile" 
ON public.profiles FOR UPDATE USING (auth.uid() = id);`;
                        navigator.clipboard.writeText(sql);
                        setCopiedSql(true);
                        setTimeout(() => setCopiedSql(false), 2000);
                      }}
                      className="button button-outline compact"
                      style={{ padding: "5px 10px", fontSize: "10px" }}
                    >
                      {copiedSql ? "✓ Copied to Clipboard!" : "📋 Copy Profiles SQL"}
                    </button>
                  </div>
                  <p style={{ margin: "0 0 10px", fontSize: "11px", color: "var(--muted)", lineHeight: 1.5 }}>
                    Your application already synchronizes roles automatically into <code>auth.users.user_metadata</code>.
                    To also see the dedicated <code>profiles</code> table inside your Supabase Table Editor dashboard,
                    run this SQL script in your Supabase SQL Editor.
                  </p>
                  <pre
                    style={{
                      background: "#18201e",
                      color: "#c2d1c6",
                      padding: "14px",
                      borderRadius: "6px",
                      fontSize: "10px",
                      maxHeight: "180px",
                      overflow: "auto",
                      margin: 0,
                      fontFamily: "var(--font-dm-mono)",
                    }}
                  >
{`CREATE TYPE user_role AS ENUM ('admin', 'staff', 'visitor');

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL DEFAULT 'Operations User',
    role user_role NOT NULL DEFAULT 'visitor',
    property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);`}
                  </pre>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "20px" }}>
                <span style={{ fontSize: "11px", color: "#78857b" }}>
                  Host: <code>ralbhldjygvdwjfrgufx.supabase.co</code> (Live Supabase)
                </span>
                <button className="select-button" onClick={() => setShowInspector(false)}>
                  Close Inspector
                </button>
              </div>
            </div>
          </div>
        )}

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

              {/* Service Recovery Notes */}
              <div style={{ marginTop: "18px" }}>
                <label className="field-label" htmlFor="resolution-notes">
                  Service Recovery Notes (Supabase)
                </label>
                <textarea
                  id="resolution-notes"
                  value={resolutionNoteInput}
                  onChange={(e) => setResolutionNoteInput(e.target.value)}
                  placeholder={
                    isStaff
                      ? "Log manager actions, guest communications, compensation or staff commendations…"
                      : "Visitor accounts have read-only access to recovery notes."
                  }
                  rows={3}
                  disabled={!isStaff}
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "4px",
                    border: "1px solid #d9dfd9",
                    fontSize: "12px",
                    outline: "none",
                    background: isStaff ? "#fff" : "#f5f7f5",
                  }}
                />
              </div>

              {/* Role-based actions */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "20px", gap: "10px", flexWrap: "wrap" }}>
                {isStaff ? (
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
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "11px", color: "#3b5f75", background: "#eef4f8", padding: "5px 10px", borderRadius: "4px", border: "1px solid #c8dce8" }}>
                      🔒 Visitor Account (Read-Only)
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRoleChange("admin")}
                      className="button button-dark compact"
                      style={{ padding: "5px 10px", fontSize: "10px" }}
                    >
                      👑 Switch to Admin to Edit
                    </button>
                  </div>
                )}

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
    </>
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