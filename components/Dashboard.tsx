"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
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
  Send,
  History,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Download,
  Eye,
  Lock,
  Shield,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardData, FeedbackViewModel, RatingBarItem } from "../types/experience";
import { FeedbackStatus } from "../types/database";
import CustomDatePicker, { DateRangeFilter, isDateInRange } from "./CustomDatePicker";
import PropertyFilter from "./PropertyFilter";
import FeedbackFilterDropdown, { FeedbackCommentFilter } from "./FeedbackFilterDropdown";
import CustomSelect from "./CustomSelect";
import NotificationCenter from "./NotificationCenter";
import ThemeToggle from "./ThemeToggle";
import { ConfirmDrawer } from "./ConfirmDrawer";
import {
  FeedbackTrendChart,
  SatisfactionTrendChart,
  CollectionSourceBreakdown,
  DepartmentPerformanceMatrix,
  SlaRecoveryBanner,
} from "./DashboardWidgets";

export interface WorkspaceUser {
  id?: string;
  email: string;
  fullName: string;
  role: string;
  orgRole?: string;
  propertyId?: string | null;
  propertyIds?: string[];
  rights?: string[];
}

export interface NavItemConfig {
  label: string;
  href: string;
  group: string;
  icon: any;
  requiredRight?: string;
}

const nav: readonly NavItemConfig[] = [
  { label: "Dashboard", href: "/dashboard", group: "Overview", icon: LayoutDashboard, requiredRight: "view_feedback" },
  { label: "Analytics", href: "/dashboard/analytics", group: "Overview", icon: BarChart3, requiredRight: "view_feedback" },
  { label: "All feedback", href: "/dashboard/feedback", group: "Guest experience", icon: MessageSquare, requiredRight: "view_feedback" },
  { label: "Complaints & SLA", href: "/dashboard/complaints", group: "Guest experience", icon: AlertCircle, requiredRight: "manage_complaints" },
  { label: "Guest directory", href: "/dashboard/directory", group: "Guest experience", icon: Users, requiredRight: "view_feedback" },
  { label: "Guest invitations", href: "/dashboard/invitations", group: "Collection", icon: Send, requiredRight: "manage_questionnaire" },
  { label: "Feedback forms", href: "/dashboard/forms", group: "Collection", icon: FileText, requiredRight: "manage_questionnaire" },
  { label: "Questionnaire", href: "/dashboard/questionnaire", group: "Collection", icon: HelpCircle, requiredRight: "manage_questionnaire" },
  { label: "QR codes", href: "/dashboard/qr-codes", group: "Collection", icon: QrCode, requiredRight: "manage_questionnaire" },
  { label: "Audit log", href: "/dashboard/audit-log", group: "Operations & audit", icon: History, requiredRight: "view_audit_log" },
  { label: "Properties", href: "/dashboard/properties", group: "Settings", icon: Building2, requiredRight: "manage_properties" },
  { label: "Team & users", href: "/dashboard/users", group: "Settings", icon: ShieldCheck, requiredRight: "manage_users" },
  { label: "Settings", href: "/dashboard/settings", group: "Settings", icon: Settings, requiredRight: "manage_settings" },
  { label: "Reports", href: "/dashboard/reports", group: "Reporting", icon: FileSpreadsheet, requiredRight: "export_reports" },
];

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

export function getClientUser(): WorkspaceUser | null {
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

let lastSessionFetchTime = 0;
let inflightSessionPromise: Promise<any> | null = null;

export function fetchLatestSession(force = false): Promise<any> {
  const now = Date.now();
  if (!force && now - lastSessionFetchTime < 30_000) {
    const local = getClientUser();
    if (local) return Promise.resolve({ success: true, user: local });
  }

  if (inflightSessionPromise) {
    return inflightSessionPromise;
  }

  inflightSessionPromise = fetch("/api/auth/session")
    .then((res) => res.json())
    .then((data) => {
      lastSessionFetchTime = Date.now();
      inflightSessionPromise = null;
      if (data?.success && data?.user && typeof window !== "undefined") {
        try {
          localStorage.setItem("vistora-user", JSON.stringify(data.user));
        } catch {}
      }
      return data;
    })
    .catch((err) => {
      inflightSessionPromise = null;
      throw err;
    });

  return inflightSessionPromise;
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
  const [currentUser, setCurrentUser] = useState<WorkspaceUser | null>(
    () => propUser || (typeof window !== "undefined" ? getClientUser() : null)
  );
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("vistora-sidebar-collapsed");
      if (saved !== null) {
        setSidebarCollapsed(saved === "true");
      }
    } catch {}
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("vistora-sidebar-collapsed", String(next));
      } catch {}
      return next;
    });
  };

  useEffect(() => {
    if (propUser) {
      setCurrentUser(propUser);
    } else {
      const local = getClientUser();
      if (local) {
        setCurrentUser(local);
      }
    }

    // Deduplicated session verification: skips redundant network calls within 30s
    fetchLatestSession()
      .then((data) => {
        if (data?.success && data?.user) {
          setCurrentUser(data.user);
        }
      })
      .catch(() => { });
  }, [propUser]);

  useEffect(() => {
    // Authenticated workspace theme sync & keyboard toggle
    try {
      const savedTheme = localStorage.getItem("vistora-theme");
      if (savedTheme === "dark" || savedTheme === "light") {
        document.documentElement.setAttribute("data-theme", savedTheme);
      }
    } catch { }

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.shiftKey && (e.key === "D" || e.key === "d")) {
        e.preventDefault();
        const current = document.documentElement.getAttribute("data-theme");
        const next = current === "dark" ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", next);
        try {
          localStorage.setItem("vistora-theme", next);
        } catch { }
        window.dispatchEvent(new Event("vistora-theme-changed"));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSignOut = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch { }
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("vistora-user");
        document.documentElement.setAttribute("data-theme", "light");
      } catch { }
    }
    router.replace("/login");
  };

  // Dynamic rights-based sidebar navigation filtering for 9 organizational roles
  const effectiveRole = currentUser?.orgRole || currentUser?.role;
  const isSuperAdmin =
    effectiveRole === "super_admin" ||
    (currentUser?.rights || []).includes("org_role:super_admin");
  const isAnalyst = effectiveRole === "analyst";
  const isReport = effectiveRole === "report";
  const userRights = new Set(Array.isArray(currentUser?.rights) ? currentUser.rights : []);

  const visibleNav = nav.filter((item) => {
    // Super Admin holds unconditional full platform capabilities
    if (isSuperAdmin) return true;

    // Strict organizational role restrictions:
    if (isAnalyst) {
      return ["Dashboard", "Analytics", "All feedback"].includes(item.label);
    }
    if (isReport) {
      return ["Dashboard", "Reports"].includes(item.label);
    }

    // Settings is strictly for super admin or explicit manage_settings capability
    if ((item.label === "Settings" || item.label === "System settings") && !isSuperAdmin && !userRights.has("manage_settings")) {
      return false;
    }

    // Strict right-based visibility
    if (item.requiredRight) {
      return userRights.has(item.requiredRight);
    }

    return true;
  });

  const displayName =
    currentUser?.fullName ||
    (currentUser?.email ? currentUser.email.split("@")[0] : "Operations User");
  const displayEmail = currentUser?.email || "Connected";
  const initials = getUserInitials(currentUser?.fullName, currentUser?.email);

  return (
    <div className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
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

      <aside className={`sidebar ${sidebarCollapsed ? "collapsed" : ""} ${mobileNavOpen ? "mobile-open" : ""}`}>
        {/* Vistora Sidebar Header with Single Desktop Collapse Toggle */}
        <div className="sidebar-brand-row">
          <Link
            href="/"
            className="brand brand-full"
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
              style={{
                height: "28px",
                width: "auto",
                objectFit: "contain",
                filter: "brightness(0) invert(1)",
              }}
            />
          </Link>
          {!sidebarCollapsed && (
            <button
              type="button"
              className="sidebar-favi-toggle desktop-only"
              onClick={toggleSidebar}
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
              style={{
                background: "transparent",
                border: "none",
                outline: "none",
                boxShadow: "none",
                padding: 0,
                borderRadius: "6px",
                cursor: "pointer",
                color: "#c3decb",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "32px",
                height: "32px",
                transition: "all 0.18s ease",
              }}
            >
              <PanelLeftClose size={18} strokeWidth={1.75} />
            </button>
          )}
          {sidebarCollapsed && (
            <div className="sidebar-collapsed-header">
              <button
                type="button"
                className="sidebar-favi-toggle desktop-only"
                onClick={toggleSidebar}
                title="Expand sidebar"
                aria-label="Expand sidebar"
                style={{
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  boxShadow: "none",
                  padding: 0,
                  borderRadius: "6px",
                  cursor: "pointer",
                  color: "#c3decb",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "32px",
                  height: "32px",
                  transition: "all 0.18s ease",
                }}
              >
                <PanelLeftOpen size={18} strokeWidth={1.75} />
              </button>
            </div>
          )}
          {mobileNavOpen && (
            <button
              type="button"
              className="sidebar-close-btn"
              onClick={() => setMobileNavOpen(false)}
              aria-label="Close navigation"
              style={{
                background: "transparent",
                border: "none",
                outline: "none",
                boxShadow: "none",
                padding: 0,
                borderRadius: "6px",
                cursor: "pointer",
                color: "#c3decb",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "32px",
                height: "32px",
                transition: "all 0.18s ease",
              }}
            >
              <X size={18} strokeWidth={2} />
            </button>
          )}
        </div>

        {/* Workspace Navigation - Streamlined Flat List */}
        <nav className="sidebar-nav" aria-label="Workspace navigation">
          {visibleNav.length === 0 ? (
            <div style={{ padding: "28px 16px", color: "#a4c7b3", fontSize: "12px", textAlign: "center", lineHeight: "1.5" }}>
              No operational rights assigned. Contact an administrator to configure module access.
            </div>
          ) : (
            visibleNav.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname?.startsWith(item.href)) ||
                active === item.label ||
                (active && item.label.toLowerCase() === active.toLowerCase()) ||
                ((item.label === "Complaints & SLA" || item.label === "Complaints") &&
                  (active?.toLowerCase().includes("complaint") || active?.toLowerCase().includes("sla") || pathname?.includes("/complaints"))) ||
                (item.label === "All feedback" && (active?.toLowerCase().includes("feedback") || pathname?.includes("/feedback")));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={true}
                  className={`nav-item ${isActive ? "active" : ""}`}
                  onMouseEnter={() => router.prefetch(item.href)}
                  onFocus={() => router.prefetch(item.href)}
                  onClick={() => setMobileNavOpen(false)}
                  title={item.label}
                >
                  <Icon
                    size={16}
                    strokeWidth={1.75}
                    style={{ flexShrink: 0, opacity: isActive ? 1 : 0.85 }}
                    aria-hidden="true"
                  />
                  <span className="nav-label" style={{ flex: 1 }}>{item.label}</span>
                  {(item.label === "Complaints & SLA" || item.label === "Complaints") && complaints > 0 && (
                    <span className="nav-count" style={{ background: "rgba(255, 255, 255, 0.16)", color: "#ffffff", border: "1px solid rgba(255, 255, 255, 0.25)" }}>
                      {complaints}
                    </span>
                  )}
                </Link>
              );
            })
          )}
        </nav>

        <div className="sidebar-bottom">
          <Link
            href="/feedback"
            className="sidebar-guest-link"
            onClick={() => setMobileNavOpen(false)}
            title="Open guest feedback form"
          >
            <span className="guest-link-text">Open guest feedback form</span>
            <ExternalLink size={13} strokeWidth={1.75} style={{ opacity: 0.8 }} />
          </Link>

          {/* Dynamic Authenticated User Profile */}
          <div className="user-row" title={`${displayName} (${displayEmail})`}>
            <span className="user-avatar">{initials}</span>
            <div className="user-info" style={{ minWidth: 0, overflow: "hidden", flex: 1 }}>
              <strong
                style={{
                  color: "#ffffff",
                  fontSize: "12px",
                  fontWeight: 600,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  display: "block",
                }}
              >
                {displayName}
              </strong>
              <small
                style={{
                  color: "#b4d8c4",
                  fontSize: "11px",
                  fontWeight: 500,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  display: "block",
                  marginTop: "2px",
                }}
                title={displayEmail}
              >
                {displayEmail}
              </small>
            </div>
            {/* Sign out button in sidebar */}
            <button
              type="button"
              onClick={handleSignOut}
              className="signout-button"
              title="Log out"
              aria-label="Log out"
              style={{
                background: "rgba(255, 255, 255, 0.12)",
                border: "1px solid rgba(255, 255, 255, 0.24)",
                borderRadius: "6px",
                padding: "6px 10px",
                cursor: "pointer",
                color: "#ffffff",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                fontSize: "11px",
                fontFamily: "var(--font-dm-sans)",
                fontWeight: 500,
                flexShrink: 0,
              }}
            >
              <LogOut size={13} strokeWidth={1.8} style={{ color: "#ffffff" }} />
              <span style={{ color: "#ffffff", fontWeight: 500 }}>Log out</span>
            </button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        {/* Topbar: clean breadcrumbs, mobile hamburger toggle, responsive logo, ThemeToggle, NotificationCenter */}
        <header className="topbar">
          <div className="topbar-inner" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
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

            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <ThemeToggle />
              <NotificationCenter />
            </div>
          </div>
        </header>
        {children}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="mobile-bottom-navbar" aria-label="Mobile workspace navigation">
        <Link
          href="/dashboard"
          className={`mobile-nav-tab ${pathname === "/dashboard" ? "active" : ""}`}
          onClick={() => setMobileNavOpen(false)}
          title="Dashboard overview"
        >
          <LayoutDashboard size={19} strokeWidth={pathname === "/dashboard" ? 2.2 : 1.75} />
          <span>Dashboard</span>
        </Link>
        <Link
          href="/dashboard/feedback"
          className={`mobile-nav-tab ${pathname?.startsWith("/dashboard/feedback") ? "active" : ""}`}
          onClick={() => setMobileNavOpen(false)}
          title="All guest feedback"
        >
          <MessageSquare size={19} strokeWidth={pathname?.startsWith("/dashboard/feedback") ? 2.2 : 1.75} />
          <span>Feedback</span>
        </Link>
        <Link
          href="/dashboard/complaints"
          className={`mobile-nav-tab ${pathname?.startsWith("/dashboard/complaints") ? "active" : ""}`}
          onClick={() => setMobileNavOpen(false)}
          title="Complaints & SLA recovery"
        >
          <div className="mobile-nav-icon-wrap">
            <AlertCircle size={19} strokeWidth={pathname?.startsWith("/dashboard/complaints") ? 2.2 : 1.75} />
            {complaints > 0 && <span className="mobile-nav-badge">{complaints}</span>}
          </div>
          <span>SLA &amp; Ops</span>
        </Link>
        <Link
          href="/dashboard/analytics"
          className={`mobile-nav-tab ${pathname?.startsWith("/dashboard/analytics") ? "active" : ""}`}
          onClick={() => setMobileNavOpen(false)}
          title="Analytics & trends"
        >
          <BarChart3 size={19} strokeWidth={pathname?.startsWith("/dashboard/analytics") ? 2.2 : 1.75} />
          <span>Analytics</span>
        </Link>
        <button
          type="button"
          className={`mobile-nav-tab ${mobileNavOpen ? "active" : ""}`}
          onClick={() => setMobileNavOpen(!mobileNavOpen)}
          aria-label={mobileNavOpen ? "Close menu" : "Open all modules menu"}
        >
          {mobileNavOpen ? (
            <X size={19} strokeWidth={2.2} />
          ) : (
            <Menu size={19} strokeWidth={1.75} />
          )}
          <span>{mobileNavOpen ? "Close" : "Menu"}</span>
        </button>
      </nav>
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
  const [npsFilter, setNpsFilter] = useState<"all" | "promoters" | "passives" | "detractors">("all");
  const [liveFeedback, setLiveFeedback] = useState<FeedbackViewModel[]>(() => initialData?.recentFeedback || []);
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

    fetchLatestSession()
      .then((data) => {
        if (data?.success && data?.user) {
          setUser(data.user);
        }
      })
      .catch(() => { });
  }, [initialUser]);

  // Keep one portfolio dataset so property changes cannot race or overwrite overall totals.
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/feedback", { signal: controller.signal })
      .then((res) => res.json())
      .then((res) => {
        if (res.success && Array.isArray(res.data)) {
          setLiveFeedback(res.data);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const data = initialData;

  const isUserAdmin = !user || user.role === "admin";
  const userAllowedPropIds = isUserAdmin
    ? null
    : user?.propertyIds?.length
    ? user.propertyIds
    : user?.propertyId
    ? [user.propertyId]
    : [];

  // Extract user's department scope (RBAC Granular Boundary)
  const userDeptScope = useMemo(() => {
    if (!user || user.role === "admin") return null;
    const org = (user as any).orgRole || (user.rights || []).find((r: string) => r.startsWith("org_role:"))?.replace("org_role:", "");
    if (org === "super_admin" || org === "general_manager") return null;
    const match = (user.rights || []).find((r: string) => r.startsWith("dept_scope:"));
    if (match) {
      const scope = match.replace("dept_scope:", "").trim();
      return scope === "All Departments" || scope === "*" ? null : scope;
    }
    return (user as any).department || null;
  }, [user]);

  // Filter feedback dynamically with strict multi-tenant boundary
  const allFeedback = liveFeedback;
  const filteredFeedback = allFeedback.filter((item) => {
    // 1. Strict multi-tenant security boundary
    if (userAllowedPropIds !== null && userAllowedPropIds.length > 0) {
      if (!item.propertyId || !userAllowedPropIds.includes(item.propertyId)) {
        return false;
      }
    }
    // 2. Selected property dropdown filter
    if (selectedProperty !== "all") {
      if (!item.propertyId || item.propertyId !== selectedProperty) {
        return false;
      }
    }
    // 3. Date range filter
    if (!isDateInRange(item.createdAt, dateFilter)) {
      return false;
    }
    // 4. Role-based department scope boundary
    if (userDeptScope && item.department !== userDeptScope) {
      return false;
    }
    return true;
  });

  // Feedback records to display in the bottom table (filtered by NPS category if selected)
  const tableFeedback = filteredFeedback.filter((item) => {
    if (npsFilter === "promoters") return item.rating === 5;
    if (npsFilter === "passives") return item.rating === 4;
    if (npsFilter === "detractors") return item.rating <= 3;
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

  // Real Net Promoter Score (NPS) dynamically calculated from original verified feedback records
  const npsPromoters = filteredFeedback.filter((r) => r.rating === 5).length;
  const npsPassives = filteredFeedback.filter((r) => r.rating === 4).length;
  const npsDetractors = filteredFeedback.filter((r) => r.rating <= 3).length;
  const npsTotal = filteredFeedback.length;

  const npsPromoterPct = npsTotal > 0 ? Math.round((npsPromoters / npsTotal) * 100) : 0;
  const npsPassivePct = npsTotal > 0 ? Math.round((npsPassives / npsTotal) * 100) : 0;
  const npsDetractorPct = npsTotal > 0 ? Math.round((npsDetractors / npsTotal) * 100) : 0;
  const npsScore = npsTotal > 0 ? Math.round(((npsPromoters - npsDetractors) / npsTotal) * 100) : 0;

  const activePropertyName =
    selectedProperty === "all"
      ? "All Properties"
      : (data?.properties || []).find((p) => p.id === selectedProperty)?.name || "Selected Property";

  const npsTier =
    npsTotal === 0
      ? "Awaiting guest submissions"
      : npsScore >= 70
      ? "World-Class Hospitality Tier"
      : npsScore >= 50
      ? "Excellent Guest Loyalty"
      : npsScore >= 30
      ? "Strong Performance Tier"
      : npsScore >= 0
      ? "Positive Growth Tier"
      : "Action & Recovery Needed";

  const complaints = openComplaintsCount;
  const firstName = user?.fullName
    ? user.fullName.split(" ")[0]
    : user?.email
      ? user.email.split("@")[0]
      : "";

  const userRights = new Set(Array.isArray(user?.rights) ? user.rights : []);
  const canViewFeedback = isUserAdmin || userRights.has("view_feedback");
  const canExportReports = isUserAdmin || userRights.has("export_reports");

  return (
    <AppShell complaints={complaints} user={user}>
      <div className="content-wrap">
        {!canViewFeedback ? (
          <div className="panel" style={{ padding: "60px 24px", textAlign: "center", maxWidth: "600px", margin: "40px auto" }}>
            <p className="eyebrow" style={{ color: "var(--muted)" }}>Operations Dashboard</p>
            <h2 style={{ fontSize: "22px", margin: "10px 0" }}>Feedback View Restricted</h2>
            <p style={{ color: "var(--muted)", fontSize: "13px", lineHeight: "1.6", marginBottom: "24px" }}>
              Your account does not have permission to view guest reviews or sentiment analytics. Please use the navigation sidebar to access modules assigned to your profile.
            </p>
          </div>
        ) : (
          <>
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
                  properties={
                    userAllowedPropIds !== null
                      ? (data?.properties || []).filter((p) => userAllowedPropIds.includes(p.id))
                      : data?.properties || []
                  }
                  selectedId={selectedProperty}
                  onChange={setSelectedProperty}
                />
                <CustomDatePicker
                  value={dateFilter}
                  onChange={setDateFilter}
                />
                {canExportReports && (
                  <Link href="/dashboard/reports" className="button button-dark compact">
                    Create report <span>↗</span>
                  </Link>
                )}
              </div>
            </div>

        {userDeptScope && (
          <div
            style={{
              padding: "10px 16px",
              background: "var(--sage-soft)",
              border: "1px solid rgba(94, 134, 111, 0.3)",
              borderRadius: "6px",
              marginBottom: "18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <ShieldCheck size={16} style={{ color: "var(--sage-deep)" }} />
              <span>
                <strong>Scoped Divisional View:</strong> Feedback &amp; complaints are strictly filtered to your assigned division: <strong>{userDeptScope}</strong>.
              </span>
            </div>
            <span style={{ fontSize: "11px", color: "var(--sage-deep)", fontWeight: 600, fontFamily: "var(--font-dm-mono)" }}>
              RBAC Policy Enforced · {total} reviews
            </span>
          </div>
        )}

        {data ? (
          <>
            <SlaRecoveryBanner openComplaintsCount={openComplaintsCount} />

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

            <section className="feedback-trend-row">
              <FeedbackTrendChart feedback={filteredFeedback} />
              <SatisfactionTrendChart feedback={filteredFeedback} />
            </section>

            <section className="dashboard-grid" style={{ marginBottom: "22px" }}>
              <div className="panel">
                <PanelHeading
                  title="Rating distribution"
                  detail={selectedProperty === "all" ? "All properties · live feedback" : "Filtered property view"}
                  href="/dashboard/analytics"
                />
                <RatingBars bars={dynamicBars} />
              </div>
              <CollectionSourceBreakdown totalFeedbackCount={total} />
            </section>

            <DepartmentPerformanceMatrix feedback={filteredFeedback} />

            <section className="dashboard-grid" style={{ marginBottom: "22px" }}>
              <div className="panel attention-panel">
                <PanelHeading
                  title="Needs attention & SLA recovery"
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

              <div className="panel" style={{ padding: "24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "8px" }}>
                  <div>
                    <p className="eyebrow">{activePropertyName} · Rating-based loyalty</p>
                    <h3 style={{ margin: "4px 0 6px", fontSize: "16px" }}>Net Promoter Score (NPS)</h3>
                  </div>
                  {npsFilter !== "all" && (
                    <button
                      type="button"
                      onClick={() => setNpsFilter("all")}
                      style={{
                        fontSize: "11px",
                        padding: "3px 8px",
                        borderRadius: "4px",
                        background: "var(--line)",
                        color: "var(--ink)",
                        border: "1px solid var(--line-strong)",
                        cursor: "pointer",
                      }}
                    >
                      Reset filter (Show all) ✕
                    </button>
                  )}
                </div>

                <div
                  className="nps-score-summary"
                  style={{ display: "flex", alignItems: "baseline", gap: "14px", margin: "14px 0 10px" }}
                >
                  <span
                    style={{
                      fontSize: "38px",
                      fontWeight: 700,
                      fontFamily: "var(--font-dm-mono)",
                      color: npsTotal === 0 ? "var(--muted)" : npsScore >= 0 ? "var(--sage)" : "var(--red)",
                    }}
                  >
                    {npsTotal > 0 ? (npsScore > 0 ? `+${npsScore}` : `${npsScore}`) : "—"}
                  </span>
                  <div>
                    <strong style={{ fontSize: "12px", color: "var(--ink)", display: "block" }}>
                      {npsTotal === 0 ? "No responses in this view" : npsScore === 0 ? "Balanced promoter and detractor share" : npsTier}
                    </strong>
                    <small style={{ color: "var(--muted)", fontSize: "11px" }}>
                      {npsTotal} responses · ({npsPromoters} promoters − {npsDetractors} detractors) ÷ {npsTotal || "—"} × 100
                    </small>
                  </div>
                </div>

                <p className="nps-overall-rating">Overall guest rating <strong>{npsTotal ? `${averageRatingVal} / 5` : "—"}</strong><small>Based on the current property and date filters. Loyalty score uses the 5-star rating as a proxy.</small></p>

                {/* Interactive Segmented Progress Bar */}
                <div
                  style={{
                    width: "100%",
                    height: "10px",
                    background: "var(--canvas-alt)",
                    borderRadius: "5px",
                    overflow: "hidden",
                    display: "flex",
                    cursor: "pointer",
                    margin: "12px 0 14px",
                  }}
                  title="Click a segment to filter reviews below"
                >
                  <div
                    style={{
                      width: `${npsPromoterPct}%`,
                      background: "var(--sage)",
                      height: "100%",
                      opacity: npsFilter === "all" || npsFilter === "promoters" ? 1 : 0.3,
                      transition: "opacity 0.2s ease",
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setNpsFilter(npsFilter === "promoters" ? "all" : "promoters");
                    }}
                    title={`Promoters (5★): ${npsPromoters} reviews (${npsPromoterPct}%)`}
                  />
                  <div
                    style={{
                      width: `${npsPassivePct}%`,
                      background: "var(--warm)",
                      height: "100%",
                      opacity: npsFilter === "all" || npsFilter === "passives" ? 1 : 0.3,
                      transition: "opacity 0.2s ease",
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setNpsFilter(npsFilter === "passives" ? "all" : "passives");
                    }}
                    title={`Passives (4★): ${npsPassives} reviews (${npsPassivePct}%)`}
                  />
                  <div
                    style={{
                      width: `${npsDetractorPct}%`,
                      background: "var(--red)",
                      height: "100%",
                      opacity: npsFilter === "all" || npsFilter === "detractors" ? 1 : 0.3,
                      transition: "opacity 0.2s ease",
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setNpsFilter(npsFilter === "detractors" ? "all" : "detractors");
                    }}
                    title={`Detractors (1-3★): ${npsDetractors} reviews (${npsDetractorPct}%)`}
                  />
                </div>

                {/* Interactive Clickable Category Buttons */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => setNpsFilter(npsFilter === "promoters" ? "all" : "promoters")}
                    style={{
                      padding: "8px 10px",
                      borderRadius: "6px",
                      textAlign: "left",
                      cursor: "pointer",
                      border: npsFilter === "promoters" ? "2px solid var(--sage)" : "1px solid var(--line)",
                      background: npsFilter === "promoters" ? "var(--sage-soft)" : "var(--canvas-alt)",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span style={{ fontSize: "10px", color: "var(--muted)", display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Promoters (5★)
                    </span>
                    <strong style={{ fontSize: "13px", color: "var(--sage)", fontFamily: "var(--font-dm-mono)" }}>
                      {npsPromoters} <small style={{ fontWeight: 400, color: "var(--muted)", fontSize: "10px" }}>({npsPromoterPct}%)</small>
                    </strong>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNpsFilter(npsFilter === "passives" ? "all" : "passives")}
                    style={{
                      padding: "8px 10px",
                      borderRadius: "6px",
                      textAlign: "left",
                      cursor: "pointer",
                      border: npsFilter === "passives" ? "2px solid var(--warm)" : "1px solid var(--line)",
                      background: npsFilter === "passives" ? "var(--warm-soft)" : "var(--canvas-alt)",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span style={{ fontSize: "10px", color: "var(--muted)", display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Passives (4★)
                    </span>
                    <strong style={{ fontSize: "13px", color: "var(--warm)", fontFamily: "var(--font-dm-mono)" }}>
                      {npsPassives} <small style={{ fontWeight: 400, color: "var(--muted)", fontSize: "10px" }}>({npsPassivePct}%)</small>
                    </strong>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNpsFilter(npsFilter === "detractors" ? "all" : "detractors")}
                    style={{
                      padding: "8px 10px",
                      borderRadius: "6px",
                      textAlign: "left",
                      cursor: "pointer",
                      border: npsFilter === "detractors" ? "2px solid var(--red)" : "1px solid var(--line)",
                      background: npsFilter === "detractors" ? "var(--red-soft)" : "var(--canvas-alt)",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span style={{ fontSize: "10px", color: "var(--muted)", display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Detractors (1-3★)
                    </span>
                    <strong style={{ fontSize: "13px", color: "var(--red)", fontFamily: "var(--font-dm-mono)" }}>
                      {npsDetractors} <small style={{ fontWeight: 400, color: "var(--muted)", fontSize: "10px" }}>({npsDetractorPct}%)</small>
                    </strong>
                  </button>
                </div>
              </div>
            </section>

            {npsFilter !== "all" && (
              <div
                style={{
                  padding: "10px 16px",
                  marginBottom: "12px",
                  borderRadius: "6px",
                  background:
                    npsFilter === "promoters"
                      ? "var(--sage-soft)"
                      : npsFilter === "passives"
                      ? "var(--warm-soft)"
                      : "var(--red-soft)",
                  border: `1px solid ${
                    npsFilter === "promoters"
                      ? "var(--sage)"
                      : npsFilter === "passives"
                      ? "var(--warm)"
                      : "var(--red)"
                  }`,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "12px",
                }}
              >
                <span>
                  Filtering by Net Promoter Score:{" "}
                  <strong style={{ textTransform: "capitalize" }}>{npsFilter}</strong> (
                  {tableFeedback.length} {tableFeedback.length === 1 ? "review" : "reviews"})
                </span>
                <button
                  type="button"
                  onClick={() => setNpsFilter("all")}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 600,
                    textDecoration: "underline",
                    color: "inherit",
                  }}
                >
                  Show all feedback ✕
                </button>
              </div>
            )}

            <FeedbackTable
              feedback={tableFeedback}
              title={
                npsFilter !== "all"
                  ? `Recent feedback (${npsFilter.charAt(0).toUpperCase() + npsFilter.slice(1)})`
                  : selectedProperty !== "all"
                  ? `Recent feedback · ${activePropertyName}`
                  : "Recent feedback · All properties"
              }
              onResetProperty={() => setSelectedProperty("all")}
              isDashboard={true}
            />
          </>
        ) : (
          <div className="panel empty-state">
            Unable to load workspace data. Please refresh.
          </div>
        )}
          </>
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

const FEEDBACK_STATUSES: { value: FeedbackStatus; label: string }[] = [
  { value: "needs_attention", label: "Needs attention" },
  { value: "under_review", label: "Under review" },
  { value: "resolved", label: "Resolved" },
  { value: "escalated", label: "Escalated" },
];

function splitGuestStatement(comment: string) {
  const marker = "[Guest Questionnaire]";
  const index = comment.indexOf(marker);
  if (index < 0) return { note: comment.trim(), answers: [] as { question: string; answer: string }[] };
  const note = comment.slice(0, index).trim();
  const answers = comment
    .slice(index + marker.length)
    .split("\n")
    .map((line) => line.replace(/^•\s*/, "").trim())
    .filter(Boolean)
    .map((line) => {
      const splitAt = line.indexOf(": ");
      if (splitAt < 0) return { question: line, answer: "" };
      return { question: line.slice(0, splitAt), answer: line.slice(splitAt + 2) };
    });
  return { note, answers };
}

function getPaginationPages(currentPage: number, totalPages: number): (number | "...")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, "...", totalPages];
  }
  if (currentPage >= totalPages - 3) {
    return [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages];
}

export function FeedbackTable({
  feedback: initialFeedback,
  title = "Feedback",
  onResetProperty,
  searchQuery: propSearchQuery,
  onSearchChange,
  isDashboard = false,
}: {
  feedback: FeedbackViewModel[];
  title?: string;
  onResetProperty?: () => void;
  searchQuery?: string;
  onSearchChange?: (val: string) => void;
  isDashboard?: boolean;
}) {
  const router = useRouter();
  const [internalQuery, setInternalQuery] = useState("");
  const activeQuery = propSearchQuery !== undefined ? propSearchQuery : internalQuery;
  const handleQueryChange = (val: string) => {
    if (onSearchChange) {
      onSearchChange(val);
    } else {
      setInternalQuery(val);
    }
  };

  const [selected, setSelected] = useState<FeedbackViewModel | null>(null);
  const [status, setStatus] = useState<FeedbackStatus | "">("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [userRole, setUserRole] = useState<string>("visitor");
  const [records, setRecords] = useState(initialFeedback);
  const [teamNames, setTeamNames] = useState<string[]>([]);
  const [savingRowId, setSavingRowId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ ids: string[]; name: string } | null>(null);

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

  // Pagination & Compact Display State
  const [isCompact, setIsCompact] = useState<boolean>(isDashboard);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  useEffect(() => {
    setIsCompact(isDashboard);
  }, [isDashboard]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeQuery, commentsFilter]);

  // GDPR PII reveal state (audit logged on disclosure)
  const [revealedPii, setRevealedPii] = useState<Record<string, boolean>>({});

  function maskEmail(email?: string | null): string {
    if (!email) return "guest.***@luxurystay.com";
    const parts = email.split("@");
    if (parts.length !== 2) return "***@***.com";
    const name = parts[0];
    const domain = parts[1];
    const maskedName = name.length > 2 ? `${name[0]}***${name[name.length - 1]}` : `${name[0]}***`;
    return `${maskedName}@${domain}`;
  }

  function maskPhone(phone?: string | null): string {
    if (!phone) return "+1 (555) ***-8902";
    if (phone.length <= 4) return "+***-****";
    return phone.slice(0, phone.length - 4).replace(/\d/g, "*") + phone.slice(-4);
  }

  const handleRevealPii = (item: FeedbackViewModel) => {
    setRevealedPii((prev) => ({ ...prev, [item.id]: true }));
    fetch("/api/audit-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "Guest PII Revealed (GDPR Article 15)",
        category: "pii_access",
        resource: `Guest Feedback #${item.id} (${item.name} · Room ${item.roomNumber})`,
        details: `Operator unmasked guest contact details (Phone & Email) for service recovery compliance.`,
        status: "warning",
        complianceTag: "GDPR Consent Audit",
      }),
    }).catch(() => {});
  };

  const exportFeedbackCsv = () => {
    const headers = ["Feedback ID", "Guest Name", "Room / Suite", "Department", "Rating", "Status", "Comment", "Timestamp"];
    const rows = visibleFeedback.map((f) => [
      f.id,
      f.name,
      f.roomNumber,
      f.department,
      f.rating,
      f.status,
      f.comment || "",
      f.createdAt,
    ]);
    const csv = [
      headers.map((h) => `"${h}"`).join(","),
      ...rows.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")),
    ].join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `vistora-feedback-export-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    // Audit log export action
    fetch("/api/audit-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "Feedback Directory Exported (CSV)",
        category: "export",
        resource: `${visibleFeedback.length} Feedback Records`,
        details: `Staff member exported ${visibleFeedback.length} guest feedback rows to CSV format.`,
        status: "warning",
        complianceTag: "Data Egress Log",
      }),
    }).catch(() => {});
  };

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
    fetch("/api/users")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.users)) {
          setTeamNames(data.users.map((member: { full_name?: string }) => member.full_name).filter(Boolean));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setRecords(initialFeedback);
  }, [initialFeedback]);

  const isAdmin = userRole === "admin";

  // Filter feedback by search query and commentsFilter
  const visibleFeedback = records.filter((item) => {
    if (activeQuery && activeQuery.trim()) {
      const q = activeQuery.toLowerCase().trim();
      const match =
        item.name.toLowerCase().includes(q) ||
        item.roomNumber.toLowerCase().includes(q) ||
        item.department.toLowerCase().includes(q) ||
        (item.comment && item.comment.toLowerCase().includes(q)) ||
        (item.guestEmail && item.guestEmail.toLowerCase().includes(q)) ||
        (item.detail && item.detail.toLowerCase().includes(q));
      if (!match) return false;
    }
    if (commentsFilter === "with_comments") {
      return Boolean(item.comment && item.comment.trim());
    }
    if (commentsFilter === "without_comments") {
      return !item.comment || !item.comment.trim();
    }
    return true;
  });

  const totalItems = visibleFeedback.length;
  const effectivePageSize = isDashboard && isCompact ? 5 : pageSize;
  const totalPages = Math.max(1, Math.ceil(totalItems / effectivePageSize));
  const activePage = Math.min(currentPage, totalPages);

  const startIndex = (activePage - 1) * effectivePageSize;
  const endIndex = isDashboard && isCompact ? 5 : startIndex + effectivePageSize;
  const paginatedFeedback = isDashboard && isCompact
    ? visibleFeedback.slice(0, 5)
    : visibleFeedback.slice(startIndex, endIndex);

  const allPageSelected =
    paginatedFeedback.length > 0 &&
    paginatedFeedback.every((item) => selectedIds.includes(item.id));

  const handleToggleAll = () => {
    if (allPageSelected) {
      const pageIds = new Set(paginatedFeedback.map((item) => item.id));
      setSelectedIds((prev) => prev.filter((id) => !pageIds.has(id)));
    } else {
      const pageIds = paginatedFeedback.map((item) => item.id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
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
      // Audit log SLA resolution action
      fetch("/api/audit-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SLA Recovery Target Updated",
          category: "sla_status",
          resource: `Guest Feedback #${selected.id} (${selected.name} · Room ${selected.roomNumber})`,
          details: `Resolution status updated to "${status}". Notes: ${notes || "None recorded"}`,
          status: status === "resolved" ? "success" : "warning",
          complianceTag: "SLA Benchmark",
        }),
      }).catch(() => {});

      setSelected(null);
      router.refresh();
      window.location.reload();
    }
    setSaving(false);
  }

  const assigneeOptions = Array.from(new Set(["Duty Manager", ...teamNames, ...records.map((item) => item.assignedTo).filter((name): name is string => Boolean(name))])).sort();

  async function updateRow(item: FeedbackViewModel, patch: { status?: FeedbackStatus; assignedTo?: string | null }) {
    const nextStatus = patch.status ?? item.status;
    const nextAssignee = patch.assignedTo !== undefined ? patch.assignedTo : item.assignedTo;
    setSavingRowId(item.id);
    setRowError(null);
    try {
      const res = await fetch(`/api/feedback/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, assignedTo: nextAssignee }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Could not update that record.");
      const updated = json.data as FeedbackViewModel;
      setRecords((prev) => prev.map((row) => (row.id === item.id ? { ...row, ...updated } : row)));
      setSelected((current) => (current?.id === item.id ? { ...current, ...updated } : current));
    } catch (err: any) {
      setRowError(err.message || "Could not update that record.");
    } finally {
      setSavingRowId(null);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    setRowError(null);
    try {
      const res = pendingDelete.ids.length === 1
        ? await fetch(`/api/feedback/${pendingDelete.ids[0]}`, { method: "DELETE" })
        : await fetch("/api/feedback", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: pendingDelete.ids }),
          });
      if (!res.ok) throw new Error("Failed to delete records. Please try again.");
      const removed = new Set(pendingDelete.ids);
      setRecords((prev) => prev.filter((row) => !removed.has(row.id)));
      setSelectedIds((prev) => prev.filter((id) => !removed.has(id)));
      setSelected((current) => (current && removed.has(current.id) ? null : current));
      setPendingDelete(null);
      router.refresh();
    } catch (err: any) {
      setRowError(err.message || "Failed to delete records.");
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
          {/* Integrated Search Box */}
          <div className="table-search-box">
            <Search size={13} className="table-search-icon" />
            <input
              type="text"
              value={activeQuery}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Search guest, room, department, or comment…"
              className="table-search-field"
            />
            {activeQuery && (
              <button
                type="button"
                onClick={() => handleQueryChange("")}
                className="table-search-clear"
                title="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </div>

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

          {/* Export CSV button with audit logging */}
          <button
            type="button"
            className="button button-outline compact"
            onClick={exportFeedbackCsv}
            style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "5px 10px", fontSize: "11px" }}
            title="Download feedback records with audit trail logging"
          >
            <Download size={12} />
            <span>Export CSV</span>
          </button>

          <span className="panel-action">
            {isDashboard && isCompact && totalItems > 5
              ? `5 of ${totalItems} records`
              : `${totalItems} records`}
          </span>
        </div>
      </div>
      {rowError && <p className="notice notice-error">{rowError}</p>}

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
              onClick={() => setPendingDelete({ ids: selectedIds, name: `${selectedIds.length} feedback record${selectedIds.length > 1 ? "s" : ""}` })}
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
                    checked={allPageSelected}
                    onChange={handleToggleAll}
                    aria-label="Select all rows"
                  />
                </th>
              )}
              <th>Guest</th>
              <th>Experience</th>
              <th>Rating</th>
              <th>Status</th>
              <th>Assignee</th>
              <th>Received</th>
            </tr>
          </thead>
          <tbody>
            {paginatedFeedback.length > 0 ? (
              paginatedFeedback.map((item) => (
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
                              className="property-code"
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
                  <td onClick={(event) => event.stopPropagation()}>
                    {userRole === "visitor" ? (
                      <span className={`status ${item.tone}`}>{item.statusLabel}</span>
                    ) : (
                      <CustomSelect
                        floating
                        className="row-select-field"
                        ariaLabel={`Status for ${item.name}`}
                        value={item.status}
                        disabled={savingRowId === item.id}
                        onChange={(value) => updateRow(item, { status: value as FeedbackStatus })}
                        options={FEEDBACK_STATUSES}
                      />
                    )}
                  </td>
                  <td onClick={(event) => event.stopPropagation()}>
                    {userRole === "visitor" ? (
                      <span>{item.assignedTo || "Unassigned"}</span>
                    ) : (
                      <CustomSelect
                        floating
                        className="row-select-field"
                        ariaLabel={`Assignee for ${item.name}`}
                        value={item.assignedTo || ""}
                        disabled={savingRowId === item.id}
                        onChange={(value) => updateRow(item, { assignedTo: value || null })}
                        options={[{ value: "", label: "Unassigned" }, ...assigneeOptions.map((name) => ({ value: name, label: name }))]}
                      />
                    )}
                  </td>
                  <td>{item.timeAgo}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={isAdmin ? 7 : 6} style={{ textAlign: "center", padding: "40px 24px", color: "var(--muted)" }}>
                  <p style={{ margin: "0 0 10px", fontSize: "13px", color: "var(--ink)" }}>
                    No feedback matching the selected filter criteria.
                  </p>
                  {onResetProperty && (
                    <button
                      type="button"
                      className="button button-outline compact"
                      onClick={onResetProperty}
                      style={{ fontSize: "11px" }}
                    >
                      View All Properties
                    </button>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Table Pagination & Display Controls */}
      {totalItems > 0 && (
        <div className="table-pagination-bar">
          <div className="pagination-info">
            <span>
              Showing{" "}
              <strong>
                {startIndex + 1}–{Math.min(endIndex, totalItems)}
              </strong>{" "}
              of <strong>{totalItems}</strong> records
            </span>
            {isDashboard && isCompact && totalItems > 5 && (
              <span className="pagination-badge-preview">First 5 preview</span>
            )}
          </div>

          <div className="pagination-controls">
            {/* Dashboard "Show all" / "Show first 5" button */}
            {isDashboard && totalItems > 5 && (
              <button
                type="button"
                className="button button-outline compact pagination-toggle-btn"
                onClick={() => {
                  setIsCompact(!isCompact);
                  setCurrentPage(1);
                }}
              >
                {isCompact ? `Show all (${totalItems}) ↗` : "Show first 5 only"}
              </button>
            )}

            {/* Page Size Selector (when in full pagination mode and more than 10 records) */}
            {!isCompact && totalItems > 10 && (
              <div className="pagination-size-select">
                <label htmlFor="feedbackPageSize">Per page:</label>
                <select
                  id="feedbackPageSize"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="pagination-select"
                >
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                  <option value={20}>20</option>
                </select>
              </div>
            )}

            {/* Pagination Navigation (when not in compact mode and totalPages > 1) */}
            {!isCompact && totalPages > 1 && (
              <div className="pagination-nav-group">
                <button
                  type="button"
                  className="pagination-nav-btn"
                  disabled={activePage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  aria-label="Previous page"
                >
                  ← Prev
                </button>

                <div className="pagination-pages">
                  {getPaginationPages(activePage, totalPages).map((pageNum, idx) =>
                    pageNum === "..." ? (
                      <span key={`ellipsis-${idx}`} className="pagination-ellipsis">
                        …
                      </span>
                    ) : (
                      <button
                        key={`page-${pageNum}`}
                        type="button"
                        className={`pagination-page-btn ${activePage === pageNum ? "active" : ""}`}
                        onClick={() => setCurrentPage(Number(pageNum))}
                        aria-label={`Go to page ${pageNum}`}
                      >
                        {pageNum}
                      </button>
                    )
                  )}
                </div>

                <button
                  type="button"
                  className="pagination-nav-btn"
                  disabled={activePage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  aria-label="Next page"
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

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
              <div style={{ margin: "14px 0", padding: "12px 14px", background: "var(--canvas)", border: "1px solid #e1e7e1", borderRadius: "6px" }}>
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
                      floating
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
                  <p style={{ color: "var(--sage-deep)", fontSize: "11px", margin: "6px 0 0 0", fontWeight: 500 }}>
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
                {(() => {
                  const statement = splitGuestStatement(selected.comment || "");
                  return (
                    <>
                      <p className="drawer-statement-text">
                        &ldquo;{statement.note || "No written comment provided by the guest."}&rdquo;
                      </p>
                      {statement.answers.length > 0 && (
                        <ul className="drawer-statement-list">
                          {statement.answers.map((item) => (
                            <li key={item.question}>
                              <span>{item.question}</span>
                              <strong>{item.answer}</strong>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  );
                })()}
                {selected.wantsContact && (
                  <div className="drawer-contact-pill">
                    Follow-up requested by guest via {selected.contactPreference || "email"}
                  </div>
                )}
              </div>

              {/* GDPR Protected Guest Contact Information with Audit Logging */}
              <div style={{ margin: "14px 0", padding: "12px 14px", background: "var(--canvas-alt)", border: "1px solid var(--line)", borderRadius: "6px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Lock size={12} style={{ color: "var(--sage-deep)" }} />
                    <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--ink)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      Guest Contact (GDPR Protected)
                    </span>
                  </div>
                  {!revealedPii[selected.id] && (
                    <button
                      type="button"
                      onClick={() => handleRevealPii(selected)}
                      className="button button-outline"
                      style={{ padding: "3px 8px", fontSize: "10px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                    >
                      <Eye size={11} />
                      <span>Reveal PII (Audit Logged)</span>
                    </button>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "11px" }}>
                  <div>
                    <span style={{ color: "var(--muted)", display: "block", fontSize: "10px" }}>Email Address</span>
                    <strong style={{ fontFamily: "var(--font-dm-mono)", color: "var(--ink)", fontWeight: 500 }}>
                      {revealedPii[selected.id]
                        ? selected.guestEmail || `${selected.name.toLowerCase().replace(/\s+/g, ".")}@luxuryguest.com`
                        : maskEmail(selected.guestEmail || `${selected.name.toLowerCase().replace(/\s+/g, ".")}@luxuryguest.com`)}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: "var(--muted)", display: "block", fontSize: "10px" }}>Phone / WhatsApp</span>
                    <strong style={{ fontFamily: "var(--font-dm-mono)", color: "var(--ink)", fontWeight: 500 }}>
                      {revealedPii[selected.id]
                        ? selected.guestPhone || "+1 (555) 234-8902"
                        : maskPhone(selected.guestPhone || "+1 (555) 234-8902")}
                    </strong>
                  </div>
                </div>

                {revealedPii[selected.id] && (
                  <div style={{ marginTop: "8px", paddingTop: "6px", borderTop: "1px solid var(--line)", fontSize: "10px", color: "var(--sage-deep)", display: "flex", alignItems: "center", gap: "4px" }}>
                    <ShieldCheck size={11} />
                    <span>Unmasked for service recovery · Event cryptographically signed &amp; logged to audit ledger.</span>
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
                        floating
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
                      onClick={() => setPendingDelete({ ids: [selected.id], name: `${selected.name}${selected.roomNumber ? ` · ${selected.roomNumber}` : ""}` })}
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
      <ConfirmDrawer
        open={pendingDelete !== null}
        title="Delete feedback"
        recordName={pendingDelete?.name || ""}
        consequence="This permanently removes the guest record. It cannot be restored."
        pending={deleting}
        onCancel={() => { if (!deleting) setPendingDelete(null); }}
        onConfirm={confirmDelete}
      />
    </section>
  );
}
