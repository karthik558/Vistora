"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
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
  Building2,
  HelpCircle,
  LogOut,
  Menu,
  X,
  Trash2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardData, FeedbackViewModel, RatingBarItem } from "../types/experience";
import { FeedbackStatus } from "../types/database";
import CustomDatePicker, { DateRangeFilter, isDateInRange } from "./CustomDatePicker";
import PropertyFilter from "./PropertyFilter";
import FeedbackFilterDropdown, { FeedbackCommentFilter } from "./FeedbackFilterDropdown";
import CustomSelect from "./CustomSelect";

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
  { label: "Questionnaire", href: "/dashboard/questionnaire", group: "Collection", icon: HelpCircle },
  { label: "QR codes", href: "/dashboard/qr-codes", group: "Collection", icon: QrCode },
  { label: "Properties", href: "/dashboard/properties", group: "Settings", icon: Building2, adminOnly: true },
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
  } catch { }

  if (typeof document !== "undefined") {
    const match = document.cookie.match(/(?:^|;\s*)vistora-user=([^;]+)/);
    if (match) {
      try {
        return JSON.parse(decodeURIComponent(match[1]));
      } catch { }
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
  const pathname = usePathname();
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
          } catch { }
        }
      })
      .catch(() => { });
  }, [propUser]);

  const handleSignOut = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch { }
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("vistora-user");
      } catch { }
    }
    router.push("/login");
    router.refresh();
  };

  // Keep navigation visible for all users
  const visibleNav = nav;
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
              src="/logo1.webp"
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
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/dashboard" && pathname?.startsWith(item.href)) ||
                    active === item.label ||
                    (active && item.label.toLowerCase() === active.toLowerCase()) ||
                    (item.label === "Complaints" && (active?.toLowerCase().includes("complaint") || pathname?.includes("/complaints"))) ||
                    (item.label === "All feedback" && (active?.toLowerCase().includes("feedback") || pathname?.includes("/feedback")));
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
                src="/logo1.webp"
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
  const [selectedProperty, setSelectedProperty] = useState<string | "all">("all");
  const [dateFilter, setDateFilter] = useState<DateRangeFilter>({
    preset: "all",
    startDate: null,
    endDate: null,
  });

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
      .catch(() => { });
  }, [initialUser]);

  const data = initialData;

  // Filter feedback dynamically by selectedProperty and dateFilter
  const allFeedback = data?.recentFeedback || [];
  const filteredFeedback = allFeedback.filter((item) => {
    if (selectedProperty !== "all") {
      if (!item.propertyId || item.propertyId !== selectedProperty) {
        return false;
      }
    }
    if (!isDateInRange(item.createdAt, dateFilter)) {
      return false;
    }
    return true;
  });

  const total = filteredFeedback.length;
  const totalRatingSum = filteredFeedback.reduce((acc, curr) => acc + curr.rating, 0);
  const averageRatingVal = total > 0 ? (totalRatingSum / total).toFixed(2) : "0.0";
  const satisfiedCount = filteredFeedback.filter((r) => r.rating >= 4).length;
  const satisfactionRateVal = total > 0 ? ((satisfiedCount / total) * 100).toFixed(1) : "0";
  const openComplaintsCount = filteredFeedback.filter(
    (r) => r.status === "needs_attention" || r.status === "escalated" || r.rating <= 2
  ).length;

  const distributionCounts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  for (const row of filteredFeedback) {
    if (row.rating >= 1 && row.rating <= 5) {
      distributionCounts[row.rating] = (distributionCounts[row.rating] || 0) + 1;
    }
  }

  const dynamicBars: RatingBarItem[] = [5, 4, 3, 2, 1].map((stars) => {
    const count = distributionCounts[stars] || 0;
    const percentage = total > 0 ? `${Math.round((count / total) * 100)}%` : "0%";
    return {
      stars: String(stars),
      percentage,
      count,
    };
  });

  const complaints = openComplaintsCount;
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
          <div className="page-heading-actions">
            <PropertyFilter
              properties={data?.properties || []}
              selectedId={selectedProperty}
              onChange={setSelectedProperty}
            />
            <CustomDatePicker
              value={dateFilter}
              onChange={setDateFilter}
            />
            <Link href="/dashboard/reports" className="button button-dark compact">
              Create report <span>↗</span>
            </Link>
          </div>
        </div>

        {data ? (
          <>
            <section className="metric-grid">
              <Metric
                label="Feedback received"
                value={total.toLocaleString()}
                note={selectedProperty !== "all" || dateFilter.preset !== "all" ? "filtered records" : "verified submissions"}
              />
              <Metric
                label="Average rating"
                value={averageRatingVal}
                suffix="/ 5"
                note={total > 0 ? `from ${total} reviews` : "no reviews recorded"}
              />
              <Metric
                label="Guest satisfaction"
                value={satisfactionRateVal}
                suffix="%"
                note={total > 0 ? "rated 4 or 5 stars" : "no ratings logged"}
              />
              <Metric
                label="Open complaints"
                value={String(openComplaintsCount)}
                note={openComplaintsCount > 0 ? "requires follow-up" : "all caught up"}
              />
            </section>

            <section className="dashboard-grid">
              <div className="panel">
                <PanelHeading
                  title="Rating distribution"
                  detail={selectedProperty === "all" ? "All properties · live feedback" : "Filtered property view"}
                  href="/dashboard/analytics"
                />
                <RatingBars bars={dynamicBars} />
              </div>
              <div className="panel attention-panel">
                <PanelHeading
                  title="Needs attention"
                  detail="Open guest moments"
                  href="/dashboard/complaints"
                />
                <div className="attention-list">
                  {filteredFeedback.filter(
                    (r) => r.status === "needs_attention" || r.status === "under_review" || r.wantsContact
                  ).length ? (
                    filteredFeedback
                      .filter(
                        (r) => r.status === "needs_attention" || r.status === "under_review" || r.wantsContact
                      )
                      .slice(0, 4)
                      .map((item) => (
                        <Link className="attention-item" href="/dashboard/complaints" key={item.id}>
                          <span className={`attention-dot ${item.tone === "urgent" || item.rating <= 2 ? "critical" : item.status === "under_review" ? "warning" : "neutral"}`} />
                          <div>
                            <strong>{item.tone === "urgent" || item.rating <= 2 ? "Guest complaint" : item.wantsContact ? "Contact requested" : "Under review"}</strong>
                            <p>{item.name} · {item.roomNumber || "Suite"}</p>
                            <small>{item.timeAgo}</small>
                          </div>
                          <span>→</span>
                        </Link>
                      ))
                  ) : (
                    <p className="empty-state">No open items in this filter view. Your teams are caught up.</p>
                  )}
                </div>
              </div>
            </section>

            <FeedbackTable
              feedback={filteredFeedback.slice(0, 8)}
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

export function RatingBars({ bars }: { bars: RatingBarItem[] }) {
  return (
    <div className="rating-bars dashboard-rating-bars">
      {bars.map((bar) => (
        <div className="bar-row" key={bar.stars}>
          <span className="bar-label">{bar.stars} stars</span>
          <div className="bar-track">
            <i style={{ width: bar.percentage }} />
          </div>
          <strong className="bar-value">{bar.count}</strong>
        </div>
      ))}
    </div>
  );
}

export function FeedbackTable({
  feedback: initialFeedback,
  title = "Feedback",
}: {
  feedback: FeedbackViewModel[];
  title?: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<FeedbackViewModel | null>(null);
  const [status, setStatus] = useState<FeedbackStatus | "">("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [userRole, setUserRole] = useState<string>("visitor");

  // Property assignment for admins
  const [allProperties, setAllProperties] = useState<Array<{ id: string; name: string; code: string; location?: string }>>([]);
  const [feedbackPropertyId, setFeedbackPropertyId] = useState<string>("");
  const [reassigningProperty, setReassigningProperty] = useState(false);
  const [propertyAssignSuccess, setPropertyAssignSuccess] = useState(false);

  // Selection state for admins
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // Comments visibility toggle and filter
  const [showComments, setShowComments] = useState<boolean>(true);
  const [commentsFilter, setCommentsFilter] = useState<FeedbackCommentFilter>("all");

  const truncateReview = (text?: string | null, max = 55): string => {
    if (!text) return "";
    const trimmed = text.trim();
    if (trimmed.length <= max) return trimmed;
    return trimmed.slice(0, max).trim() + "…";
  };

  useEffect(() => {
    const user = getClientUser();
    if (user?.role) {
      setUserRole(user.role);
    }
    fetch("/api/properties")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.properties) {
          setAllProperties(data.properties);
        }
      })
      .catch(() => {});
  }, []);

  const isAdmin = userRole === "admin";

  // Filter feedback by commentsFilter
  const visibleFeedback = initialFeedback.filter((item) => {
    if (commentsFilter === "with_comments") {
      return Boolean(item.comment && item.comment.trim());
    }
    if (commentsFilter === "without_comments") {
      return !item.comment || !item.comment.trim();
    }
    return true;
  });

  const allVisibleSelected =
    visibleFeedback.length > 0 &&
    visibleFeedback.every((item) => selectedIds.includes(item.id));

  const handleToggleAll = () => {
    if (allVisibleSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(visibleFeedback.map((item) => item.id));
    }
  };

  const handleToggleRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

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
      router.refresh();
      window.location.reload();
    }
    setSaving(false);
  }

  async function handleDeleteBatch() {
    if (selectedIds.length === 0) return;
    const confirmMsg = `Are you sure you want to permanently delete ${selectedIds.length} feedback record${selectedIds.length > 1 ? "s" : ""}? This action cannot be undone.`;
    if (!window.confirm(confirmMsg)) return;

    setDeleting(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
      });
      if (res.ok) {
        setSelectedIds([]);
        router.refresh();
        window.location.reload();
      } else {
        alert("Failed to delete records. Please try again.");
      }
    } catch (err: any) {
      alert(`Error deleting records: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  }

  async function handleDeleteSingle(id: string) {
    const confirmMsg = "Are you sure you want to delete this feedback record? This action cannot be undone.";
    if (!window.confirm(confirmMsg)) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/feedback/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSelected(null);
        router.refresh();
        window.location.reload();
      } else {
        alert("Failed to delete record. Please try again.");
      }
    } catch (err: any) {
      alert(`Error deleting record: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="panel table-panel">
      <div className="panel-heading table-panel-header">
        <div>
          <h2>{title}</h2>
          <p>Guest ratings, department signal, and resolution status</p>
        </div>
        <div className="table-header-controls">
          {/* Comments Filter Dropdown matching PropertyFilter style */}
          <FeedbackFilterDropdown
            value={commentsFilter}
            onChange={setCommentsFilter}
          />

          {/* Toggle comments visibility */}
          <button
            type="button"
            className={`comment-toggle-pill ${showComments ? "active" : ""}`}
            onClick={() => setShowComments(!showComments)}
            title={showComments ? "Click to hide written comments" : "Click to show written comments"}
          >
            <MessageSquare size={12} />
            <span>{showComments ? "Comments visible" : "Comments hidden"}</span>
          </button>

          <span className="panel-action">{visibleFeedback.length} records</span>
        </div>
      </div>

      {/* Admin Batch Action Bar */}
      {isAdmin && selectedIds.length > 0 && (
        <div className="bulk-actions-toolbar">
          <span className="bulk-count">
            <strong>{selectedIds.length}</strong> record{selectedIds.length > 1 ? "s" : ""} selected
          </span>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              className="button button-danger compact"
              onClick={handleDeleteBatch}
              disabled={deleting}
            >
              <Trash2 size={13} />
              {deleting ? "Deleting…" : `Delete selected (${selectedIds.length})`}
            </button>
            <button
              type="button"
              className="button button-outline compact"
              onClick={() => setSelectedIds([])}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {isAdmin && (
                <th style={{ width: "36px", textAlign: "center" }}>
                  <input
                    type="checkbox"
                    className="custom-table-checkbox"
                    checked={allVisibleSelected}
                    onChange={handleToggleAll}
                    aria-label="Select all rows"
                  />
                </th>
              )}
              <th>Guest</th>
              <th>Experience</th>
              <th>Rating</th>
              <th>Status</th>
              <th>Received</th>
            </tr>
          </thead>
          <tbody>
            {visibleFeedback.length > 0 ? (
              visibleFeedback.map((item) => (
                <tr
                  className="clickable-row"
                  key={item.id}
                  onClick={() => {
                    setSelected(item);
                    setStatus(item.status);
                    setNotes(item.resolutionNotes || "");
                    setFeedbackPropertyId(item.propertyId || "");
                    setPropertyAssignSuccess(false);
                  }}
                >
                  {isAdmin && (
                    <td
                      style={{ width: "36px", textAlign: "center" }}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        className="custom-table-checkbox"
                        checked={selectedIds.includes(item.id)}
                        onChange={() => handleToggleRow(item.id)}
                        aria-label={`Select feedback from ${item.name}`}
                      />
                    </td>
                  )}
                  <td>
                    <div className="guest-cell">
                      <span className="mini-avatar">{item.initials}</span>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <strong>{item.name}</strong>
                          {item.propertyId && (
                            <span
                              style={{
                                fontSize: "9px",
                                fontFamily: "var(--font-dm-mono)",
                                background: "var(--line)",
                                color: "var(--ink)",
                                padding: "1px 5px",
                                borderRadius: "3px",
                                fontWeight: 600,
                                letterSpacing: "0.04em",
                              }}
                              title={allProperties.find((p) => p.id === item.propertyId)?.name || "Hotel location"}
                            >
                              {allProperties.find((p) => p.id === item.propertyId)?.code || "HOTEL"}
                            </span>
                          )}
                        </div>
                        <small>{item.roomNumber || "Suite"}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="experience-cell">
                      <span className="department-tag">{item.department}</span>
                      {showComments && (
                        item.comment ? (
                          <div className="table-comment-box" title={item.comment}>
                            <p className="table-comment-text">“{truncateReview(item.comment, 55)}”</p>
                          </div>
                        ) : (
                          <span className="table-no-comment">No written comment</span>
                        )
                      )}
                    </div>
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
              ))
            ) : (
              <tr>
                <td colSpan={isAdmin ? 6 : 5} style={{ textAlign: "center", padding: "36px", color: "var(--muted)" }}>
                  No feedback matching the selected filter criteria.
                </td>
              </tr>
            )}
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
                <X size={18} strokeWidth={1.75} />
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

              {/* Property Assignment Section (Admin can change property) */}
              <div style={{ margin: "14px 0", padding: "12px 14px", background: "#f8faf8", border: "1px solid #e1e7e1", borderRadius: "6px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--ink)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Property Location
                  </span>
                  {isAdmin && (
                    <span style={{ fontSize: "10px", color: "var(--muted)", fontFamily: "var(--font-dm-mono)" }}>
                      Admin configurable
                    </span>
                  )}
                </div>

                {isAdmin ? (
                  <div style={{ display: "flex", gap: "8px", marginTop: "6px", alignItems: "flex-start" }}>
                    <CustomSelect
                      value={feedbackPropertyId}
                      onChange={(val) => {
                        setFeedbackPropertyId(val);
                        setPropertyAssignSuccess(false);
                      }}
                      placeholder="Select property location"
                      header="Assign Property"
                      options={allProperties.map((p) => ({
                        value: p.id,
                        label: `${p.name} (${p.code})`,
                        detail: p.location,
                      }))}
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      className="button button-dark compact"
                      disabled={reassigningProperty || !feedbackPropertyId || feedbackPropertyId === selected.propertyId}
                      onClick={async () => {
                        setReassigningProperty(true);
                        try {
                          const res = await fetch("/api/feedback", {
                            method: "PATCH",
                            headers: {
                              "Content-Type": "application/json",
                              "x-user-role": userRole || "admin",
                            },
                            credentials: "include",
                            body: JSON.stringify({ id: selected.id, propertyId: feedbackPropertyId }),
                          });
                          const data = await res.json();
                          if (data.success) {
                            selected.propertyId = feedbackPropertyId;
                            setPropertyAssignSuccess(true);
                            router.refresh();
                          } else {
                            alert(data.error || "Failed to reassign property.");
                          }
                        } catch {
                          alert("Failed to update property assignment.");
                        } finally {
                          setReassigningProperty(false);
                        }
                      }}
                    >
                      {reassigningProperty ? "Saving…" : "Save property"}
                    </button>
                  </div>
                ) : (
                  <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--ink)", fontWeight: 500 }}>
                    {allProperties.find((p) => p.id === selected.propertyId)?.name || "General / Unassigned"}
                  </p>
                )}

                {propertyAssignSuccess && (
                  <p style={{ color: "#254230", fontSize: "11px", margin: "6px 0 0 0", fontWeight: 500 }}>
                    ✓ Property reassigned successfully.
                  </p>
                )}
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
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <span className="field-label" style={{ margin: 0 }}>
                        Resolution status
                      </span>
                      <CustomSelect
                        value={status}
                        onChange={(val) => setStatus(val as FeedbackStatus)}
                        header="Resolution Status"
                        options={[
                          { value: "needs_attention", label: "Needs attention", detail: "Open guest alert requiring action" },
                          { value: "under_review", label: "Under review", detail: "Duty manager investigating incident" },
                          { value: "resolved", label: "Resolved", detail: "Guest contact & recovery completed" },
                          { value: "escalated", label: "Escalated", detail: "Senior leadership notification sent" },
                        ]}
                      />
                    </div>
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

                {/* Admin Delete Action */}
                {isAdmin && (
                  <div style={{ marginTop: "20px", paddingTop: "14px", borderTop: "1px solid var(--line)", display: "flex", justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      className="button button-danger compact"
                      onClick={() => handleDeleteSingle(selected.id)}
                      disabled={deleting}
                    >
                      <Trash2 size={13} />
                      {deleting ? "Deleting…" : "Delete this feedback record"}
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