"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  BarChart3,
  MessageSquare,
  AlertCircle,
  Users,
  FileText,
  QrCode,
  FileSpreadsheet,
  ExternalLink,
  ShieldCheck,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardData, FeedbackViewModel } from "../types/experience";
import { FeedbackStatus } from "../types/database";

export interface WorkspaceUser {
  id?: string;
  email: string;
  fullName: string;
  role: "admin" | "staff" | "visitor";
}

const nav = [
  { label: "Dashboard", href: "/dashboard", group: "Overview", icon: LayoutDashboard },
  { label: "Analytics", href: "/dashboard/analytics", group: "Overview", icon: BarChart3 },
  { label: "All feedback", href: "/dashboard/feedback", group: "Guest experience", icon: MessageSquare },
  { label: "Complaints", href: "/dashboard/complaints", group: "Guest experience", icon: AlertCircle },
  { label: "Guest directory", href: "/dashboard/directory", group: "Guest experience", icon: Users },
  { label: "Feedback forms", href: "/dashboard/forms", group: "Collection", icon: FileText },
  { label: "QR codes", href: "/dashboard/qr-codes", group: "Collection", icon: QrCode },
  { label: "Team & users", href: "/dashboard/users", group: "Settings", icon: ShieldCheck, adminOnly: true },
  { label: "Reports", href: "/dashboard/reports", group: "Reporting", icon: FileSpreadsheet },
] as const;

function getUserInitials(name?: string, email?: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    if (parts.length === 1 && parts[0].length >= 2) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    if (parts.length === 1) {
      return parts[0][0].toUpperCase();
    }
  }
  if (email && email.trim()) {
    return email.trim().slice(0, 2).toUpperCase();
  }
  return "OP";
}

function getClientUser(): WorkspaceUser | null {
  if (typeof window === "undefined") return null;

  try {
    const saved = localStorage.getItem("vistora-user");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed?.email) return parsed;
    }
  } catch {}

  if (typeof document !== "undefined") {
    const match = document.cookie.match(/(?:^|;\s*)vistora-user=([^;]+)/);
    if (match) {
      try {
        return JSON.parse(decodeURIComponent(match[1]));
      } catch {}
    }
  }

  return null;
}

export function AppShell({
  children,
  active = "Dashboard",
  complaints = 0,
  user: propUser,
}: {
  children: React.ReactNode;
  active?: string;
  complaints?: number;
  user?: WorkspaceUser | null;
}) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<WorkspaceUser | null>(propUser || null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (propUser) {
      setCurrentUser(propUser);
      return;
    }

    const local = getClientUser();
    if (local) {
      setCurrentUser(local);
    }

    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => {
        if (data?.success && data?.user) {
          setCurrentUser(data.user);
          try {
            localStorage.setItem("vistora-user", JSON.stringify(data.user));
          } catch {}
        }
      })
      .catch(() => {});
  }, [propUser]);

  const handleSignOut = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("vistora-user");
      } catch {}
    }
    router.push("/login");
    router.refresh();
  };

  // Filter navigation for visitor role
  const visibleNav = nav.filter((item) => {
    if ((item as any).adminOnly && currentUser?.role === "visitor") {
      return false;
    }
    return true;
  });

  const groups = [...new Set(visibleNav.map((item) => item.group))];
  const displayName =
    currentUser?.fullName ||
    (currentUser?.email ? currentUser.email.split("@")[0] : "Operations User");
  const displayEmail = currentUser?.email || "Connected";
  const initials = getUserInitials(currentUser?.fullName, currentUser?.email);

  return (
    <div className="app-shell">
      {/* Mobile Drawer Backdrop */}
      <AnimatePresence>
        {mobileNavOpen && (
          <motion.div
            key="mobile-nav-backdrop"
            className="sidebar-mobile-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            onClick={() => setMobileNavOpen(false)}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      <aside className={`sidebar ${mobileNavOpen ? "mobile-open" : ""}`}>
        {/* Vistora Official Logo in Sidebar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 10px 22px" }}>
          <Link
            href="/"
            className="brand"
            title="Vistora Home"
            onClick={() => setMobileNavOpen(false)}
            style={{ display: "flex", alignItems: "center", textDecoration: "none" }}
          >
            <Image
              src="/logo.webp"
              alt="Vistora"
              width={130}
              height={34}
              priority
              style={{ height: "28px", width: "auto", objectFit: "contain" }}
            />
          </Link>
          {mobileNavOpen && (
            <button
              type="button"
              className="sidebar-close-btn"
              onClick={() => setMobileNavOpen(false)}
              aria-label="Close navigation"
            >
              <X size={18} strokeWidth={2} />
            </button>
          )}
        </div>

        {/* Workspace Navigation with Monochrome Lucide Icons */}
        <nav className="sidebar-nav" aria-label="Workspace navigation">
          {groups.map((group) => (
            <div className="nav-group" key={group}>
              <p>{group}</p>
              {visibleNav
                .filter((item) => item.group === group)
                .map((item) => {
                  const Icon = item.icon;
                  const isActive = active === item.label;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`nav-item ${isActive ? "active" : ""}`}
                      onClick={() => setMobileNavOpen(false)}
                    >
                      <Icon
                        size={16}
                        strokeWidth={1.75}
                        style={{ flexShrink: 0, opacity: isActive ? 1 : 0.75 }}
                        aria-hidden="true"
                      />
                      <span style={{ flex: 1 }}>{item.label}</span>
                      {item.label === "Complaints" && complaints > 0 && (
                        <span className="nav-count" style={{ background: "var(--line)", color: "var(--ink)", border: "1px solid var(--line-strong)" }}>
                          {complaints}
                        </span>
                      )}
                    </Link>
                  );
                })}
            </div>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <Link
            href="/feedback"
            className="sidebar-guest-link"
            onClick={() => setMobileNavOpen(false)}
          >
            <span>Open guest feedback form</span>
            <ExternalLink size={13} strokeWidth={1.75} style={{ opacity: 0.8 }} />
          </Link>

          {/* Dynamic Authenticated User Profile without hover tooltip */}
          <div className="user-row">
            <span className="user-avatar">{initials}</span>
            <div style={{ minWidth: 0, overflow: "hidden", flex: 1 }}>
              <strong style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {displayName}
              </strong>
              <small style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
                {displayEmail}
              </small>
            </div>
            {/* Sign out button in sidebar */}
            <button
              type="button"
              onClick={handleSignOut}
              className="signout-button"
              aria-label="Sign out"
              style={{
                background: "transparent",
                border: "1px solid var(--line)",
                borderRadius: "4px",
                padding: "5px 8px",
                cursor: "pointer",
                color: "var(--muted)",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                fontSize: "10px",
                fontFamily: "var(--font-dm-mono)",
                flexShrink: 0,
              }}
            >
              <LogOut size={12} strokeWidth={1.75} />
              <span>Exit</span>
            </button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        {/* Topbar: clean breadcrumbs, mobile hamburger toggle, responsive logo */}
        <header className="topbar">
          <div className="topbar-inner">
            <button
              type="button"
              className="mobile-menu-btn"
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              aria-label={mobileNavOpen ? "Close menu" : "Open navigation menu"}
            >
              {mobileNavOpen ? <X size={19} strokeWidth={2} /> : <Menu size={19} strokeWidth={2} />}
            </button>
            <Link href="/" className="topbar-mobile-logo" title="Vistora Home">
              <Image
                src="/logo.webp"
                alt="Vistora"
                width={95}
                height={24}
                priority
                style={{ height: "22px", width: "auto", objectFit: "contain" }}
              />
            </Link>
            <div className="breadcrumbs">
              <span>Workspace</span>
              <b>/</b>
              <strong>{active}</strong>
            </div>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}

function Metric({
  label,
  value,
  suffix,
  note,
}: {
  label: string;
  value: string;
  suffix?: string;
  note: string;
}) {
  return (
    <div className="metric-card">
      <span className="metric-label">{label}</span>
      <div className="metric-value">
        {value}
        <small>{suffix}</small>
      </div>
      <div className="metric-change">{note}</div>
    </div>
  );
}

export default function Dashboard({
  initialData,
  initialUser,
}: {
  initialData?: DashboardData | null;
  initialUser?: WorkspaceUser | null;
}) {
  const [user, setUser] = useState<WorkspaceUser | null>(initialUser || null);

  useEffect(() => {
    if (initialUser) {
      setUser(initialUser);
      return;
    }
    const local = getClientUser();
    if (local) setUser(local);

    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => {
        if (data?.success && data?.user) {
          setUser(data.user);
        }
      })
      .catch(() => {});
  }, [initialUser]);

  const data = initialData;
  const complaints = data ? Number(data.metrics.openComplaints.value) : 0;
  const firstName = user?.fullName
    ? user.fullName.split(" ")[0]
    : user?.email
    ? user.email.split("@")[0]
    : "";

  return (
    <AppShell complaints={complaints} user={user}>
      <div className="content-wrap">
        <div className="page-heading">
          <div>
            <p className="eyebrow">Operations overview</p>
            <h1>{firstName ? `Good morning, ${firstName}` : "Operations Dashboard"}</h1>
            <p className="subheading">
              A clear view of the guest moments that need attention today.
            </p>
          </div>
          <Link href="/dashboard/reports" className="button button-dark compact">
            Create report <span>↗</span>
          </Link>
        </div>

        {data ? (
          <>
            <section className="metric-grid">
              <Metric
                label={data.metrics.feedbackReceived.label}
                value={data.metrics.feedbackReceived.value}
                note="verified submissions"
              />
              <Metric
                label={data.metrics.averageRating.label}
                value={data.metrics.averageRating.value}
                suffix="/ 5"
                note={data.metrics.averageRating.note}
              />
              <Metric
                label={data.metrics.satisfactionRate.label}
                value={data.metrics.satisfactionRate.value}
                suffix="%"
                note="rated 4 or 5 stars"
              />
              <Metric
                label={data.metrics.openComplaints.label}
                value={data.metrics.openComplaints.value}
                note={data.metrics.openComplaints.note}
              />
            </section>

            <section className="dashboard-grid">
              <div className="panel">
                <PanelHeading
                  title="Rating distribution"
                  detail="All properties · live feedback"
                  href="/dashboard/analytics"
                />
                <RatingBars data={data} />
              </div>
              <div className="panel attention-panel">
                <PanelHeading
                  title="Needs attention"
                  detail="Open guest moments"
                  href="/dashboard/complaints"
                />
                <div className="attention-list">
                  {data.attentionItems.length ? (
                    data.attentionItems.map((item) => (
                      <Link className="attention-item" href="/dashboard/complaints" key={item.id}>
                        <span className={`attention-dot ${item.type}`} />
                        <div>
                          <strong>{item.title}</strong>
                          <p>{item.detail}</p>
                          <small>{item.meta}</small>
                        </div>
                        <span>→</span>
                      </Link>
                    ))
                  ) : (
                    <p className="empty-state">No open items. Your teams are caught up.</p>
                  )}
                </div>
              </div>
            </section>

            <FeedbackTable
              feedback={data.recentFeedback.slice(0, 8)}
              title="Recent feedback"
            />
          </>
        ) : (
          <div className="panel empty-state">
            Unable to load workspace data. Please refresh.
          </div>
        )}
      </div>
    </AppShell>
  );
}

function PanelHeading({
  title,
  detail,
  href,
}: {
  title: string;
  detail: string;
  href: string;
}) {
  return (
    <div className="panel-heading">
      <div>
        <h2>{title}</h2>
        <p>{detail}</p>
      </div>
      <Link className="panel-action" href={href}>
        View all ↗
      </Link>
    </div>
  );
}

function RatingBars({ data }: { data: DashboardData }) {
  return (
    <div className="rating-bars dashboard-rating-bars">
      {data.ratingDistribution.bars.map((bar) => (
        <div className="bar-row" key={bar.stars}>
          <span>{bar.stars} stars</span>
          <div className="bar-track">
            <i style={{ width: bar.percentage }} />
          </div>
          <strong>{bar.count}</strong>
        </div>
      ))}
    </div>
  );
}

export function FeedbackTable({
  feedback,
  title = "Feedback",
}: {
  feedback: FeedbackViewModel[];
  title?: string;
}) {
  const [selected, setSelected] = useState<FeedbackViewModel | null>(null);
  const [status, setStatus] = useState<FeedbackStatus | "">("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [userRole, setUserRole] = useState<string>("visitor");

  useEffect(() => {
    const user = getClientUser();
    if (user?.role) {
      setUserRole(user.role);
    }
  }, []);

  async function update() {
    if (!selected || !status) return;
    setSaving(true);
    const res = await fetch(`/api/feedback/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, notes }),
    });
    if (res.ok) {
      setSelected(null);
      window.location.reload();
    }
    setSaving(false);
  }

  return (
    <section className="panel table-panel">
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          <p>Guest comments, ratings, and resolution status</p>
        </div>
        <span className="panel-action">{feedback.length} records</span>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Guest</th>
              <th>Experience</th>
              <th>Rating</th>
              <th>Status</th>
              <th>Received</th>
            </tr>
          </thead>
          <tbody>
            {feedback.map((item) => (
              <tr
                className="clickable-row"
                key={item.id}
                onClick={() => {
                  setSelected(item);
                  setStatus(item.status);
                  setNotes(item.resolutionNotes || "");
                }}
              >
                <td>
                  <div className="guest-cell">
                    <span className="mini-avatar">{item.initials}</span>
                    <div>
                      <strong>{item.name}</strong>
                      <small>{item.roomNumber}</small>
                    </div>
                  </div>
                </td>
                <td>
                  <strong>{item.department}</strong>
                  <small>{item.comment || "No comment"}</small>
                </td>
                <td>
                  <span className="table-rating">
                    {item.rating} <b>/ 5</b>
                  </span>
                </td>
                <td>
                  <span className={`status ${item.tone}`}>{item.statusLabel}</span>
                </td>
                <td>{item.timeAgo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {selected && (
          <motion.div
            key="drawer-backdrop"
            className="drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            onClick={() => setSelected(null)}
          >
            <motion.div
              key="detail-drawer"
              className="detail-drawer"
              initial={{ x: "100%", opacity: 0.85 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0.85 }}
              transition={{ type: "spring", damping: 30, stiffness: 300, mass: 0.8 }}
              onClick={(event) => event.stopPropagation()}
            >
              <button className="drawer-close" onClick={() => setSelected(null)} aria-label="Close">
                ×
              </button>
              <p className="eyebrow">Service recovery & compliance</p>
              <h2 style={{ margin: "6px 0 18px", fontSize: "22px" }}>{selected.name}</h2>

              {/* Structured Info Chips with generous spacing */}
              <div className="drawer-chip-grid">
                <div className="drawer-chip">
                  <span className="drawer-chip-label">Room / Location</span>
                  <strong className="drawer-chip-value mono">{selected.roomNumber || "Suite"}</strong>
                </div>
                <div className="drawer-chip">
                  <span className="drawer-chip-label">Department</span>
                  <strong className="drawer-chip-value">{selected.department}</strong>
                </div>
                <div className="drawer-chip">
                  <span className="drawer-chip-label">Guest Rating</span>
                  <strong className="drawer-chip-value rating">★ {selected.rating} / 5</strong>
                </div>
                <div className="drawer-chip">
                  <span className="drawer-chip-label">Logged</span>
                  <strong className="drawer-chip-value">{selected.timeAgo}</strong>
                </div>
              </div>

              {/* Guest Statement Card with generous breathing room */}
              <div className="drawer-statement-card">
                <div className="drawer-statement-header">
                  <span>Guest Statement</span>
                  <span className={`status ${selected.tone}`}>{selected.statusLabel}</span>
                </div>
                <p className="drawer-statement-text">
                  "{selected.comment || "No written comment provided by the guest."}"
                </p>
                {selected.wantsContact && (
                  <div className="drawer-contact-pill">
                    Follow-up requested by guest via {selected.contactPreference || "email"}
                  </div>
                )}
              </div>

              {/* Resolution Section (RBAC protected) */}
              <div className="drawer-resolution-section">
                <h3 style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", margin: "0 0 14px", fontWeight: 600 }}>
                  Resolution & Compliance
                </h3>

                {userRole === "visitor" ? (
                  <div className="drawer-readonly-card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                      <span style={{ fontSize: "11px", color: "var(--muted)" }}>Current Status</span>
                      <span className={`status ${selected.tone}`}>{selected.statusLabel}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: "11px", color: "var(--muted)", display: "block", marginBottom: "6px" }}>Resolution Notes</span>
                      <p style={{ margin: 0, fontSize: "12px", color: "var(--ink)", fontStyle: selected.resolutionNotes ? "normal" : "italic", lineHeight: "1.6" }}>
                        {selected.resolutionNotes || "No resolution notes recorded yet."}
                      </p>
                    </div>
                    <div style={{ marginTop: "16px", paddingTop: "12px", borderTop: "1px solid var(--line)", fontSize: "11px", color: "var(--muted)" }}>
                      Visitor access: You have view-only permissions. Compliance modifications require staff or admin privileges.
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <label className="field-label" style={{ margin: 0 }}>
                      Resolution status
                      <select
                        className="auth-input"
                        value={status}
                        onChange={(event) => setStatus(event.target.value as FeedbackStatus)}
                        style={{ marginTop: "6px" }}
                      >
                        <option value="needs_attention">Needs attention</option>
                        <option value="under_review">Under review</option>
                        <option value="resolved">Resolved</option>
                        <option value="escalated">Escalated</option>
                      </select>
                    </label>
                    <label className="field-label" style={{ margin: 0 }}>
                      Resolution notes
                      <textarea
                        className="auth-input"
                        rows={4}
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        placeholder="Record the action taken…"
                        style={{ marginTop: "6px" }}
                      />
                    </label>
                    <button className="button button-dark" disabled={saving} onClick={update} style={{ width: "100%", padding: "12px", marginTop: "4px" }}>
                      {saving ? "Saving…" : "Save resolution"}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}