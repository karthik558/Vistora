"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { useBrowserOrigin } from "../lib/useBrowserOrigin";
import { motion, AnimatePresence } from "framer-motion";
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
  ShieldCheck,
  Mail,
  Phone,
  Clock,
  CheckCircle2,
  Star,
  X,
  Send,
  Calendar,
  MessageSquare,
  Plus,
  Link as LinkIcon,
  HeartHandshake,
  UserCheck,
} from "lucide-react";
import { AppShell, FeedbackTable, WorkspaceUser, getClientUser, fetchLatestSession } from "./Dashboard";
import { DashboardData, PropertyRow, FeedbackViewModel } from "../types/experience";
import { GuestInvitation } from "../lib/services/invitationsService";
import CustomDatePicker, { DateRangeFilter, isDateInRange } from "./CustomDatePicker";
import PropertyFilter from "./PropertyFilter";
import QuestionnaireBuilder from "./QuestionnaireBuilder";
import CustomSelect from "./CustomSelect";

export default function OperationsPage({
  section,
  data,
  initialUser,
}: {
  section: string;
  data: DashboardData;
  initialUser?: WorkspaceUser | null;
}) {
  const [query, setQuery] = useState("");
  const [selectedProperty, setSelectedProperty] = useState<string | "all">("all");
  const [dateFilter, setDateFilter] = useState<DateRangeFilter>({
    preset: "all",
    startDate: null,
    endDate: null,
  });
  const [user, setUser] = useState<WorkspaceUser | null>(
    () => initialUser || (typeof window !== "undefined" ? getClientUser() : null)
  );

  useEffect(() => {
    const local = getClientUser();
    if (local && !user) setUser(local);

    fetchLatestSession()
      .then((resData) => {
        if (resData?.success && resData?.user) {
          setUser(resData.user);
        }
      })
      .catch(() => {});
  }, []);

  const isUserAdmin = user?.role === "admin";
  const userRights = new Set(Array.isArray(user?.rights) ? user.rights : []);

  let isSectionAuthorized = true;
  if (!isUserAdmin && user) {
    if (section === "reports") {
      isSectionAuthorized = userRights.has("export_reports");
    } else if (section === "questionnaire" || section === "forms" || section === "qr-codes") {
      isSectionAuthorized = userRights.has("manage_questionnaire");
    } else if (section === "complaints") {
      isSectionAuthorized = userRights.has("manage_complaints");
    } else if (section === "feedback" || section === "directory" || section === "analytics") {
      isSectionAuthorized = userRights.has("view_feedback");
    }
  }

  const userAllowedPropIds: string[] | null = isUserAdmin
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

  const feedback = useMemo(
    () =>
      data.recentFeedback
        .filter((item) => {
          if (userAllowedPropIds !== null) {
            if (!item.propertyId || !userAllowedPropIds.includes(item.propertyId)) {
              return false;
            }
          }
          return true;
        })
        .filter((item) => section !== "complaints" || item.rating <= 2 || item.status === "needs_attention")
        .filter((item) => selectedProperty === "all" || (item.propertyId && item.propertyId === selectedProperty))
        .filter((item) => isDateInRange(item.createdAt, dateFilter))
        .filter((item) => !userDeptScope || item.department === userDeptScope)
        .filter((item) => !query || `${item.name} ${item.roomNumber} ${item.department} ${item.comment || ""}`.toLowerCase().includes(query.toLowerCase())),
    [data.recentFeedback, query, section, selectedProperty, dateFilter, userAllowedPropIds, userDeptScope]
  );

  const title =
    section === "complaints"
      ? "Complaints & SLA recovery"
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
    complaints: "SLA response tracking, emergency escalations, and hospitality guest service recovery.",
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
      ? "Complaints & SLA"
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
    <AppShell active={navLabel} complaints={Number(data.metrics.openComplaints.value)} user={user}>
      <div className="content-wrap">
        {!isSectionAuthorized ? (
          <div className="panel" style={{ padding: "60px 24px", textAlign: "center", maxWidth: "600px", margin: "40px auto" }}>
            <p className="eyebrow" style={{ color: "var(--muted)" }}>Operations Module</p>
            <h2 style={{ fontSize: "22px", margin: "10px 0" }}>Access Restricted</h2>
            <p style={{ color: "var(--muted)", fontSize: "13px", lineHeight: "1.6", marginBottom: "24px" }}>
              Your account does not have permission to access the <strong>{title}</strong> module. Please use the navigation sidebar to access modules assigned to your profile.
            </p>
            <Link className="button button-dark" href="/dashboard" style={{ display: "inline-flex" }}>
              ← Return to Dashboard
            </Link>
          </div>
        ) : (
          <>
            {section !== "directory" && (
              <div className="page-heading">
                <div>
                  <p className="eyebrow">Guest experience operations</p>
                  <h1>{title}</h1>
                  <p className="subheading">{descriptions[section]}</p>
                </div>
                <div className="page-heading-actions">
                  <PropertyFilter
                    properties={
                      userAllowedPropIds !== null
                        ? data.properties.filter((p) => userAllowedPropIds.includes(p.id))
                        : data.properties
                    }
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
            )}

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
                <strong>Scoped Divisional View:</strong> Operational records and SLA queues are filtered strictly to your assigned division: <strong>{userDeptScope}</strong>.
              </span>
            </div>
            <span style={{ fontSize: "11px", color: "var(--sage-deep)", fontWeight: 600, fontFamily: "var(--font-dm-mono)" }}>
              RBAC Policy Active · {feedback.length} records
            </span>
          </div>
        )}

        <motion.div
          key={section}
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
        >
          {section === "analytics" ? (
            <Analytics
              data={data}
              selectedProperty={selectedProperty}
              dateFilter={dateFilter}
              userAllowedPropIds={userAllowedPropIds}
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
              {section === "complaints" && (
                <div
                  style={{
                    padding: "16px 20px",
                    background: "var(--red-soft)",
                    border: "1px solid var(--red)",
                    borderRadius: "8px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "12px",
                    marginBottom: "16px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <AlertTriangle size={18} style={{ color: "var(--red)" }} />
                    <div>
                      <strong style={{ fontSize: "13px", color: "var(--red)" }}>
                        Hospitality SLA Emergency Protocol Active · 15-Minute Response Target
                      </strong>
                      <p style={{ margin: "2px 0 0", fontSize: "11px", color: "var(--muted)" }}>
                        Critical reviews (1★ &amp; 2★) are prioritized. Target resolution SLA: 120 minutes.
                      </p>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "16px", fontSize: "11px", fontFamily: "var(--font-dm-mono)" }}>
                    <div>
                      <span style={{ color: "var(--muted)" }}>Target SLA: </span>
                      <strong>15m</strong>
                    </div>
                    <div>
                      <span style={{ color: "var(--muted)" }}>Compliance: </span>
                      <strong style={{ color: "var(--sage-deep)" }}>94.6%</strong>
                    </div>
                    <div>
                      <span style={{ color: "var(--muted)" }}>Queue: </span>
                      <strong style={{ color: "var(--red)" }}>{feedback.length} open</strong>
                    </div>
                  </div>
                </div>
              )}

              <FeedbackTable
                feedback={feedback}
                title={section === "complaints" ? "Open recovery queue" : "Feedback records"}
                searchQuery={query}
                onSearchChange={setQuery}
              />
            </>
          )}
        </motion.div>
          </>
        )}
      </div>
    </AppShell>
  );
}

function Analytics({
  data,
  selectedProperty,
  dateFilter,
  userAllowedPropIds,
}: {
  data: DashboardData;
  selectedProperty: string | "all";
  dateFilter: DateRangeFilter;
  userAllowedPropIds?: string[] | null;
}) {
  const filteredFeedback = useMemo(() => {
    return data.recentFeedback.filter((item) => {
      if (userAllowedPropIds !== null && userAllowedPropIds !== undefined) {
        if (!item.propertyId || !userAllowedPropIds.includes(item.propertyId)) {
          return false;
        }
      }
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
  }, [data.recentFeedback, selectedProperty, dateFilter, userAllowedPropIds]);

  const total = filteredFeedback.length;
  const totalRatingSum = filteredFeedback.reduce((acc, curr) => acc + curr.rating, 0);
  const avgRating = total > 0 ? (totalRatingSum / total).toFixed(2) : "0.0";
  const satisfiedCount = filteredFeedback.filter((r) => r.rating >= 4).length;
  const satisfactionRate = total > 0 ? ((satisfiedCount / total) * 100).toFixed(1) : "0.0";
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

  const ALL_DEPARTMENTS = [
    "Front Desk",
    "Housekeeping",
    "Food & Beverage",
    "Concierge",
    "Facilities & Room",
    "Spa & Wellness",
    "Valet & Transfers",
  ];

  return (
    <>
      <section className="metric-grid">
        <div className="metric-card">
          <span className="metric-label">Average rating</span>
          <div className="metric-value">
            {avgRating}
            <small>/ 5</small>
          </div>
          <div className="metric-change">
            {total > 0 ? `Across ${total} responses` : "No reviews recorded"}
          </div>
        </div>
        <div className="metric-card">
          <span className="metric-label">Satisfaction rate</span>
          <div className="metric-value">
            {satisfactionRate}
            <small>%</small>
          </div>
          <div className="metric-change">
            {total > 0 ? `${satisfiedCount} satisfied responses (4★ & 5★)` : "No ratings logged"}
          </div>
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

      <div className="panel analytics-panel" style={{ overflow: "hidden", borderRadius: "8px" }}>
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

      <div className="panel" style={{ overflow: "hidden", borderRadius: "8px" }}>
        <div className="panel-heading">
          <div>
            <h2>Department signal</h2>
            <p>Where guest feedback is being generated across operational touchpoints</p>
          </div>
          <span className="panel-action">{total} total reviews</span>
        </div>
        <div className="department-grid">
          {ALL_DEPARTMENTS.map((dept) => {
            const count = filteredFeedback.filter((item) => item.department === dept).length;
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <div className="department-stat" key={dept}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong>{dept}</strong>
                  <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: "11px", color: count > 0 ? "var(--ink)" : "var(--muted)" }}>
                    {pct}%
                  </span>
                </div>
                <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                  {count} {count === 1 ? "response" : "responses"}
                </span>
                <div style={{ width: "100%", height: "4px", background: "var(--canvas-alt)", borderRadius: "2px", overflow: "hidden", marginTop: "4px" }}>
                  <div
                    style={{
                      width: `${pct}%`,
                      height: "100%",
                      background: count > 0 ? "var(--sage-deep)" : "transparent",
                      borderRadius: "2px",
                      transition: "width 0.25s ease",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}


interface CrmGuestProfile {
  id: string;
  name: string;
  initials: string;
  email: string | null;
  phone: string | null;
  properties: string[];
  rooms: string[];
  totalStays: number;
  hasProvidedFeedback: boolean;
  feedbackCount: number;
  averageRating: number | null;
  latestRating: number | null;
  latestDepartment: string | null;
  sentiment: "delighted" | "positive" | "neutral" | "recovery_needed" | "pending";
  hasOpenComplaint: boolean;
  vipTier: string;
  lastActivityDate: string;
  feedbacks: FeedbackViewModel[];
  invitations: GuestInvitation[];
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
  const [invitations, setInvitations] = useState<GuestInvitation[]>([]);
  const [filterTab, setFilterTab] = useState<"all" | "provided" | "awaiting" | "recovery" | "promoters">("all");
  const [selectedGuest, setSelectedGuest] = useState<CrmGuestProfile | null>(null);

  // Quick invite dispatch inside CRM drawer
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [invitePropertyId, setInvitePropertyId] = useState(data.properties[0]?.id || "");
  const [inviteRoom, setInviteRoom] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteNotice, setInviteNotice] = useState("");
  const [inviteError, setInviteError] = useState("");

  useEffect(() => {
    let mounted = true;
    fetch("/api/invitations")
      .then((res) => res.json())
      .then((json) => {
        if (mounted && json.success && Array.isArray(json.invitations)) {
          setInvitations(json.invitations);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  // Aggregate feedback and invitations into CRM guest profiles
  const profiles = useMemo(() => {
    const map = new Map<string, CrmGuestProfile>();

    function getInitials(name: string) {
      const parts = name.trim().split(/\s+/);
      if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    // Process feedback items
    data.recentFeedback.forEach((f) => {
      const key = (f.guestEmail?.trim().toLowerCase()) || (f.guestPhone?.trim()) || f.name.trim().toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          name: f.name,
          initials: f.initials || getInitials(f.name),
          email: f.guestEmail || null,
          phone: f.guestPhone || null,
          properties: [f.detail ? f.detail.split("·")[0].trim() : "Main Property"],
          rooms: f.roomNumber ? [f.roomNumber] : [],
          totalStays: 1,
          hasProvidedFeedback: true,
          feedbackCount: 1,
          averageRating: f.rating,
          latestRating: f.rating,
          latestDepartment: f.department,
          sentiment: f.rating >= 4 ? (f.rating === 5 ? "delighted" : "positive") : f.rating === 3 ? "neutral" : "recovery_needed",
          hasOpenComplaint: f.status === "needs_attention" || f.status === "escalated",
          vipTier: "Verified Guest",
          lastActivityDate: f.createdAt,
          feedbacks: [f],
          invitations: [],
        });
      } else {
        const p = map.get(key)!;
        p.feedbacks.push(f);
        p.feedbackCount += 1;
        p.hasProvidedFeedback = true;
        if (f.roomNumber && !p.rooms.includes(f.roomNumber)) p.rooms.push(f.roomNumber);
        if (f.status === "needs_attention" || f.status === "escalated") p.hasOpenComplaint = true;
        if (new Date(f.createdAt) > new Date(p.lastActivityDate)) {
          p.lastActivityDate = f.createdAt;
          p.latestRating = f.rating;
          p.latestDepartment = f.department;
        }
      }
    });

    // Process invitations
    invitations.forEach((inv) => {
      const key = (inv.guestEmail?.trim().toLowerCase()) || (inv.guestPhone?.trim()) || inv.guestName.trim().toLowerCase();
      if (!map.has(key)) {
        const isCompleted = inv.status === "completed";
        map.set(key, {
          id: key,
          name: inv.guestName,
          initials: getInitials(inv.guestName),
          email: inv.guestEmail || null,
          phone: inv.guestPhone || null,
          properties: inv.propertyName ? [inv.propertyName] : ["Hotel Property"],
          rooms: inv.roomNumber ? [inv.roomNumber] : [],
          totalStays: 1,
          hasProvidedFeedback: isCompleted,
          feedbackCount: isCompleted ? 1 : 0,
          averageRating: inv.feedbackRating || null,
          latestRating: inv.feedbackRating || null,
          latestDepartment: null,
          sentiment: isCompleted && inv.feedbackRating ? (inv.feedbackRating >= 4 ? "positive" : "recovery_needed") : "pending",
          hasOpenComplaint: false,
          vipTier: "Touchpoint Guest",
          lastActivityDate: inv.createdAt,
          feedbacks: [],
          invitations: [inv],
        });
      } else {
        const p = map.get(key)!;
        p.invitations.push(inv);
        if (inv.propertyName && !p.properties.includes(inv.propertyName)) p.properties.push(inv.propertyName);
        if (inv.roomNumber && !p.rooms.includes(inv.roomNumber)) p.rooms.push(inv.roomNumber);
        if (!p.email && inv.guestEmail) p.email = inv.guestEmail;
        if (!p.phone && inv.guestPhone) p.phone = inv.guestPhone;
        if (new Date(inv.createdAt) > new Date(p.lastActivityDate)) {
          p.lastActivityDate = inv.createdAt;
        }
      }
    });

    // Final calculations for each profile
    const result: CrmGuestProfile[] = [];
    map.forEach((p) => {
      const ratings = p.feedbacks.map((f) => f.rating).concat(p.invitations.filter((i) => i.feedbackRating).map((i) => i.feedbackRating!));
      if (ratings.length > 0) {
        const sum = ratings.reduce((a, b) => a + b, 0);
        p.averageRating = Math.round((sum / ratings.length) * 10) / 10;
        if (p.averageRating >= 4.5) p.sentiment = "delighted";
        else if (p.averageRating >= 4.0) p.sentiment = "positive";
        else if (p.averageRating >= 3.0) p.sentiment = "neutral";
        else p.sentiment = "recovery_needed";
      }

      p.totalStays = Math.max(p.feedbacks.length, p.invitations.length, 1);
      if (p.totalStays >= 3 || p.feedbacks.length >= 2) {
        p.vipTier = "Repeat VIP Guest";
      } else if (p.hasOpenComplaint || p.sentiment === "recovery_needed") {
        p.vipTier = "Attention Needed";
      } else if (p.hasProvidedFeedback) {
        p.vipTier = "Verified Guest";
      } else {
        p.vipTier = "New Touchpoint";
      }

      result.push(p);
    });

    return result.sort((a, b) => new Date(b.lastActivityDate).getTime() - new Date(a.lastActivityDate).getTime());
  }, [data.recentFeedback, invitations]);

  // Filtered list
  const filtered = useMemo(() => {
    return profiles.filter((p) => {
      if (filterTab === "provided" && !p.hasProvidedFeedback) return false;
      if (filterTab === "awaiting" && p.hasProvidedFeedback) return false;
      if (filterTab === "recovery" && p.sentiment !== "recovery_needed" && !p.hasOpenComplaint) return false;
      if (filterTab === "promoters" && (!p.averageRating || p.averageRating < 4)) return false;

      if (query.trim()) {
        const q = query.toLowerCase();
        const inName = p.name.toLowerCase().includes(q);
        const inEmail = p.email ? p.email.toLowerCase().includes(q) : false;
        const inPhone = p.phone ? p.phone.toLowerCase().includes(q) : false;
        const inRooms = p.rooms.some((r) => r.toLowerCase().includes(q));
        const inProps = p.properties.some((prop) => prop.toLowerCase().includes(q));
        return inName || inEmail || inPhone || inRooms || inProps;
      }
      return true;
    });
  }, [profiles, filterTab, query]);

  const totalProfiles = profiles.length;
  const providedCount = profiles.filter((p) => p.hasProvidedFeedback).length;
  const awaitingCount = profiles.filter((p) => !p.hasProvidedFeedback).length;
  const recoveryCount = profiles.filter((p) => p.sentiment === "recovery_needed" || p.hasOpenComplaint).length;
  const promotersCount = profiles.filter((p) => p.averageRating && p.averageRating >= 4).length;
  const engagementRate = totalProfiles > 0 ? Math.round((providedCount / totalProfiles) * 100) : 0;

  async function handleSendQuickInvite() {
    if (!selectedGuest || !invitePropertyId || !inviteRoom.trim()) return;
    setInviteSending(true);
    setInviteError("");
    setInviteNotice("");
    try {
      const p = data.properties.find((x) => x.id === invitePropertyId);
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestName: selectedGuest.name,
          guestEmail: inviteEmail.trim() || selectedGuest.email || undefined,
          guestPhone: selectedGuest.phone || undefined,
          propertyId: invitePropertyId,
          propertyName: p?.name,
          roomNumber: inviteRoom.trim(),
          channel: (inviteEmail.trim() || selectedGuest.email) ? "email" : "direct_link",
          sendEmail: Boolean(inviteEmail.trim() || selectedGuest.email),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to dispatch invitation.");
      setInviteNotice(json.message || "Invitation created successfully!");
      if (json.invitation) {
        setInvitations((prev) => [json.invitation, ...prev]);
        setSelectedGuest((prev) =>
          prev
            ? {
                ...prev,
                invitations: [json.invitation, ...prev.invitations],
                rooms: prev.rooms.includes(inviteRoom.trim()) ? prev.rooms : [...prev.rooms, inviteRoom.trim()],
              }
            : null
        );
      }
      setShowInviteForm(false);
      setInviteRoom("");
    } catch (e: any) {
      setInviteError(e.message || "Could not dispatch invitation.");
    } finally {
      setInviteSending(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: "20px" }}>
      {/* CRM Heading */}
      <div className="page-heading" style={{ marginBottom: 0 }}>
        <div>
          <p className="eyebrow">Hospitality Relationship Management</p>
          <h1>Guest CRM &amp; Experience Directory</h1>
          <p className="subheading">
            Search guest profiles, review lifetime feedback history, track response conversion, and dispatch personalized touchpoints.
          </p>
        </div>
      </div>

      {/* CRM Metric Cards */}
      <section className="metric-grid">
        <div className="metric-card">
          <span className="metric-label">Tracked Guest Profiles</span>
          <div className="metric-value">{totalProfiles}</div>
          <div className="metric-change">Unique identified guests</div>
        </div>
        <div className="metric-card">
          <span className="metric-label">Feedback Provided</span>
          <div className="metric-value">
            {providedCount}
            <small>({engagementRate}%)</small>
          </div>
          <div className="metric-change">Submitted verified reviews</div>
        </div>
        <div className="metric-card">
          <span className="metric-label">Awaiting Responses</span>
          <div className="metric-value">{awaitingCount}</div>
          <div className="metric-change">Pending invitation touchpoints</div>
        </div>
        <div className="metric-card">
          <span className="metric-label">Requires Attention</span>
          <div className="metric-value" style={{ color: recoveryCount > 0 ? "var(--amber-deep)" : "inherit" }}>
            {recoveryCount}
          </div>
          <div className="metric-change">{recoveryCount > 0 ? "Rating ≤ 3★ or open complaint" : "All guests in good standing"}</div>
        </div>
      </section>

      {/* Filter and Search Panel */}
      <div className="panel" style={{ padding: "16px 20px" }}>
        <div
          style={{
            display: "flex",
            gap: "12px",
            alignItems: "center",
            flexWrap: "wrap",
            justifyContent: "space-between",
          }}
        >
          <div style={{ position: "relative", minWidth: "260px", flex: 1 }}>
            <Search
              size={15}
              style={{
                position: "absolute",
                left: "10px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--muted)",
              }}
            />
            <input
              type="text"
              className="auth-input"
              placeholder="Search guests by name, email, phone, room, or hotel…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ paddingLeft: "32px", height: "36px", fontSize: "12px" }}
            />
          </div>

          {/* CRM Filter Chips */}
          <div style={{ display: "flex", border: "1px solid var(--line)", borderRadius: "6px", overflow: "hidden", flexWrap: "wrap" }}>
            {[
              { id: "all", label: `All (${totalProfiles})` },
              { id: "provided", label: `Feedback Provided (${providedCount})` },
              { id: "awaiting", label: `Awaiting (${awaitingCount})` },
              { id: "recovery", label: `Requires Attention (${recoveryCount})` },
              { id: "promoters", label: `Promoters 4–5★ (${promotersCount})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterTab(tab.id as any)}
                style={{
                  padding: "8px 12px",
                  fontSize: "11px",
                  fontWeight: 600,
                  background: filterTab === tab.id ? "var(--ink)" : "var(--panel)",
                  color: filterTab === tab.id ? "var(--panel)" : "var(--muted)",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* CRM Guest Cards Grid */}
      <div className="panel" style={{ padding: "20px" }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 16px", color: "var(--muted)" }}>
            <Users size={32} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
            <p style={{ margin: 0, fontSize: "14px", fontWeight: 500 }}>No guest CRM records match your search criteria.</p>
            <p style={{ margin: "6px 0 0", fontSize: "12px" }}>Try searching by first or last name, email address, or room number.</p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: "14px",
            }}
          >
            {filtered.map((guest) => {
              const isPromoter = guest.averageRating && guest.averageRating >= 4.5;
              const needsAttention = guest.sentiment === "recovery_needed" || guest.hasOpenComplaint;

              return (
                <div
                  key={guest.id}
                  onClick={() => {
                    setSelectedGuest(guest);
                    setShowInviteForm(false);
                    setInviteNotice("");
                    setInviteError("");
                  }}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    padding: "16px",
                    borderRadius: "8px",
                    border: needsAttention
                      ? "1px solid rgba(220, 80, 50, 0.4)"
                      : isPromoter
                      ? "1px solid rgba(197, 160, 89, 0.4)"
                      : "1px solid var(--line)",
                    background: "var(--panel)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    boxShadow: "var(--shadow-sm)",
                  }}
                  className="crm-guest-card"
                >
                  <div>
                    {/* Header: Avatar, Name, Badges */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span
                          className="mini-avatar"
                          style={{
                            width: "36px",
                            height: "36px",
                            fontSize: "12px",
                            fontWeight: 700,
                            border: guest.vipTier.includes("VIP") ? "2px solid var(--gold)" : "none",
                          }}
                        >
                          {guest.initials}
                        </span>
                        <div>
                          <strong style={{ fontSize: "14px", color: "var(--ink)", display: "block" }}>{guest.name}</strong>
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: 600,
                              color: guest.vipTier.includes("VIP")
                                ? "var(--gold)"
                                : needsAttention
                                ? "var(--amber-deep)"
                                : "var(--muted)",
                              textTransform: "uppercase",
                              letterSpacing: "0.5px",
                            }}
                          >
                            {guest.vipTier}
                          </span>
                        </div>
                      </div>

                      {/* Feedback Status / Rating Badge */}
                      {guest.hasProvidedFeedback && guest.averageRating ? (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            padding: "3px 8px",
                            borderRadius: "4px",
                            fontSize: "11px",
                            fontWeight: 700,
                            background: needsAttention
                              ? "rgba(220, 80, 50, 0.1)"
                              : "rgba(197, 160, 89, 0.15)",
                            color: needsAttention ? "var(--amber-deep)" : "var(--gold-deep, #91722e)",
                          }}
                        >
                          <Star size={11} fill="currentColor" />
                          <span>{guest.averageRating}★</span>
                          <span style={{ fontSize: "10px", fontWeight: 400, opacity: 0.8 }}>
                            ({guest.feedbackCount})
                          </span>
                        </span>
                      ) : (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            padding: "3px 8px",
                            borderRadius: "4px",
                            fontSize: "11px",
                            background: "var(--canvas-alt)",
                            color: "var(--muted)",
                          }}
                        >
                          <Clock size={11} />
                          <span>Awaiting Review</span>
                        </span>
                      )}
                    </div>

                    {/* Stay & Room Details */}
                    <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "8px" }}>
                      <span>
                        {guest.rooms.length > 0 ? `Room ${guest.rooms.join(", ")}` : "Room unassigned"}
                      </span>
                      {guest.properties.length > 0 && (
                        <span> · {guest.properties[0]}</span>
                      )}
                    </div>

                    {/* Contact Info */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "3px", fontSize: "11px", color: "var(--muted)", fontFamily: "var(--font-dm-mono)" }}>
                      {guest.email && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                          <Mail size={11} />
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {guest.email}
                          </span>
                        </span>
                      )}
                      {guest.phone && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                          <Phone size={11} />
                          <span>{guest.phone}</span>
                        </span>
                      )}
                      {!guest.email && !guest.phone && (
                        <span style={{ color: "var(--line)" }}>No direct contact on file</span>
                      )}
                    </div>
                  </div>

                  {/* Card Footer: Timeline prompt */}
                  <div
                    style={{
                      marginTop: "14px",
                      paddingTop: "10px",
                      borderTop: "1px solid var(--line)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      fontSize: "11px",
                    }}
                  >
                    <span style={{ color: "var(--muted)" }}>
                      {guest.hasProvidedFeedback
                        ? `${guest.feedbackCount} feedback record${guest.feedbackCount === 1 ? "" : "s"}`
                        : `${guest.invitations.length} invitation${guest.invitations.length === 1 ? "" : "s"} sent`}
                    </span>
                    <span style={{ color: "var(--gold)", fontWeight: 600 }}>
                      View History &rarr;
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CRM Guest Detail Drawer */}
      <AnimatePresence>
        {selectedGuest && (
          <motion.div
            className="drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedGuest(null)}
          >
            <motion.div
              className="detail-drawer"
              style={{ width: "min(540px, 100%)" }}
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="drawer-close"
                onClick={() => setSelectedGuest(null)}
              >
                <X size={18} />
              </button>

              {/* Profile Header */}
              <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "20px" }}>
                <span
                  className="mini-avatar"
                  style={{
                    width: "48px",
                    height: "48px",
                    fontSize: "16px",
                    fontWeight: 700,
                    border: selectedGuest.vipTier.includes("VIP") ? "2px solid var(--gold)" : "none",
                  }}
                >
                  {selectedGuest.initials}
                </span>
                <div>
                  <p className="eyebrow" style={{ margin: 0 }}>Guest CRM Profile</p>
                  <h2 style={{ margin: "2px 0 4px", fontSize: "20px" }}>{selectedGuest.name}</h2>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 600,
                      color: selectedGuest.vipTier.includes("VIP") ? "var(--gold)" : "var(--muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    {selectedGuest.vipTier} · {selectedGuest.totalStays} Recorded Stay{selectedGuest.totalStays === 1 ? "" : "s"}
                  </span>
                </div>
              </div>

              {/* Contact Information Bar */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "10px",
                  padding: "12px 14px",
                  background: "var(--canvas-alt)",
                  borderRadius: "8px",
                  marginBottom: "20px",
                  fontSize: "12px",
                }}
              >
                <div>
                  <span style={{ display: "block", color: "var(--muted)", fontSize: "10px", textTransform: "uppercase" }}>
                    Email
                  </span>
                  {selectedGuest.email ? (
                    <a
                      href={`mailto:${selectedGuest.email}`}
                      style={{ color: "var(--ink)", fontWeight: 500, wordBreak: "break-all" }}
                    >
                      {selectedGuest.email}
                    </a>
                  ) : (
                    <span style={{ color: "var(--muted)" }}>Not provided</span>
                  )}
                </div>
                <div>
                  <span style={{ display: "block", color: "var(--muted)", fontSize: "10px", textTransform: "uppercase" }}>
                    Phone
                  </span>
                  {selectedGuest.phone ? (
                    <a href={`tel:${selectedGuest.phone}`} style={{ color: "var(--ink)", fontWeight: 500 }}>
                      {selectedGuest.phone}
                    </a>
                  ) : (
                    <span style={{ color: "var(--muted)" }}>Not provided</span>
                  )}
                </div>
                <div>
                  <span style={{ display: "block", color: "var(--muted)", fontSize: "10px", textTransform: "uppercase" }}>
                    Rooms Visited
                  </span>
                  <span style={{ color: "var(--ink)", fontWeight: 500 }}>
                    {selectedGuest.rooms.join(", ") || "None recorded"}
                  </span>
                </div>
                <div>
                  <span style={{ display: "block", color: "var(--muted)", fontSize: "10px", textTransform: "uppercase" }}>
                    Lifetime Score
                  </span>
                  <span style={{ color: "var(--ink)", fontWeight: 600 }}>
                    {selectedGuest.averageRating ? `★ ${selectedGuest.averageRating} / 5` : "No ratings yet"}
                  </span>
                </div>
              </div>

              {/* Quick Actions in Drawer */}
              <div style={{ display: "flex", gap: "10px", marginBottom: "24px" }}>
                <button
                  type="button"
                  className="button button-dark"
                  onClick={() => {
                    setShowInviteForm(!showInviteForm);
                    setInviteNotice("");
                    setInviteError("");
                    setInviteEmail(selectedGuest.email || "");
                    setInviteRoom(selectedGuest.rooms[0] || "");
                  }}
                  style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                >
                  <Send size={14} />
                  <span>{showInviteForm ? "Close Touchpoint Form" : "Dispatch New Invitation"}</span>
                </button>
              </div>

              {/* Inline Invitation Dispatch Form */}
              <AnimatePresence>
                {showInviteForm && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{
                      overflow: "hidden",
                      background: "var(--canvas-alt)",
                      border: "1px solid var(--line)",
                      borderRadius: "8px",
                      padding: "16px",
                      marginBottom: "24px",
                    }}
                  >
                    <h4 style={{ margin: "0 0 12px", fontSize: "13px" }}>Dispatch Feedback Invitation to {selectedGuest.name}</h4>
                    {inviteNotice && (
                      <div style={{ padding: "8px 10px", background: "rgba(197, 160, 89, 0.15)", borderRadius: "4px", color: "var(--ink)", fontSize: "12px", marginBottom: "10px" }}>
                        {inviteNotice}
                      </div>
                    )}
                    {inviteError && (
                      <div style={{ padding: "8px 10px", background: "rgba(220, 80, 50, 0.1)", borderRadius: "4px", color: "var(--amber-deep)", fontSize: "12px", marginBottom: "10px" }}>
                        {inviteError}
                      </div>
                    )}

                    <div style={{ display: "grid", gap: "10px" }}>
                      <div>
                        <label className="field-label" style={{ display: "block", marginBottom: "4px" }}>
                          Target Property
                        </label>
                        <CustomSelect
                          value={invitePropertyId}
                          onChange={(val) => setInvitePropertyId(val)}
                          options={data.properties.map((p) => ({ value: p.id, label: p.name }))}
                        />
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                        <div>
                          <label className="field-label" style={{ display: "block", marginBottom: "4px" }}>
                            Room / Suite *
                          </label>
                          <input
                            type="text"
                            className="auth-input"
                            placeholder="e.g. 302"
                            value={inviteRoom}
                            onChange={(e) => setInviteRoom(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="field-label" style={{ display: "block", marginBottom: "4px" }}>
                            Recipient Email
                          </label>
                          <input
                            type="email"
                            className="auth-input"
                            placeholder="guest@domain.com"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        className="button button-dark"
                        disabled={inviteSending || !inviteRoom.trim()}
                        onClick={handleSendQuickInvite}
                        style={{ marginTop: "6px" }}
                      >
                        {inviteSending ? "Dispatching…" : inviteEmail.trim() ? "Send via Email & Generate Link" : "Generate Tracked Link"}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* CRM Experience Timeline */}
              <h3 style={{ fontSize: "14px", fontWeight: 600, margin: "0 0 14px 0", letterSpacing: "0.2px" }}>
                Guest Experience History &amp; Timeline
              </h3>

              <div style={{ display: "grid", gap: "12px" }}>
                {selectedGuest.feedbacks.length === 0 && selectedGuest.invitations.length === 0 ? (
                  <p style={{ color: "var(--muted)", fontSize: "12px" }}>No previous activity found for this guest.</p>
                ) : null}

                {/* Feedback Submissions */}
                {selectedGuest.feedbacks.map((f) => (
                  <div
                    key={f.id}
                    style={{
                      padding: "14px",
                      background: "var(--panel)",
                      border: "1px solid var(--line)",
                      borderRadius: "6px",
                      fontSize: "12px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          fontWeight: 700,
                          color: f.rating <= 2 ? "var(--amber-deep)" : "var(--gold)",
                        }}
                      >
                        <Star size={12} fill="currentColor" />
                        <span>{f.rating} of 5 · {f.department}</span>
                      </span>
                      <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                        {new Date(f.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div style={{ color: "var(--muted)", fontSize: "11px", marginBottom: "6px" }}>
                      Room {f.roomNumber} · Status: <strong>{f.statusLabel}</strong>
                    </div>

                    {f.comment && (
                      <p style={{ margin: "6px 0 0", color: "var(--ink)", fontStyle: "italic", lineHeight: 1.5 }}>
                        &ldquo;{f.comment}&rdquo;
                      </p>
                    )}

                    {f.wantsContact && (
                      <div
                        style={{
                          marginTop: "8px",
                          padding: "4px 8px",
                          borderRadius: "4px",
                          background: "rgba(220, 80, 50, 0.08)",
                          color: "var(--amber-deep)",
                          fontSize: "11px",
                        }}
                      >
                        Follow-up requested by guest via {f.contactPreference || "email"}.
                      </div>
                    )}
                  </div>
                ))}

                {/* Invitations History */}
                {selectedGuest.invitations.map((inv) => (
                  <div
                    key={inv.id}
                    style={{
                      padding: "14px",
                      background: "var(--canvas-alt)",
                      border: "1px solid var(--line)",
                      borderRadius: "6px",
                      fontSize: "12px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <span style={{ fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "6px" }}>
                        {inv.channel === "email" ? <Mail size={12} /> : <LinkIcon size={12} />}
                        <span>Invitation Dispatched ({inv.channel.replace("_", " ")})</span>
                      </span>
                      <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                        {new Date(inv.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div style={{ color: "var(--muted)", fontSize: "11px" }}>
                      Room {inv.roomNumber} · {inv.propertyName || "Hotel"} · Status:{" "}
                      <strong style={{ color: inv.status === "completed" ? "var(--sage-deep)" : "var(--amber)" }}>
                        {inv.status}
                      </strong>
                    </div>
                    {inv.notes && (
                      <div style={{ marginTop: "6px", fontSize: "11px", color: "var(--muted)" }}>
                        Note: {inv.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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
          <li>1–5 guest rating & experience department</li>
          <li>Customizable multi-question questionnaire options</li>
          <li>Written guest commentary & contact request</li>
          <li>Real-time synchronization with operational dashboard</li>
        </ul>
        <div className="form-card-actions" style={{ marginTop: "16px" }}>
          <Link className="button button-outline compact" href="/dashboard/questionnaire">
            Design questionnaire questions →
          </Link>
        </div>
      </div>
    </div>
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
  const origin = useBrowserOrigin();
  const [qrType, setQrType] = useState<"room" | "dining" | "spa" | "reception" | "general">("room");
  const [identifier, setIdentifier] = useState("Room 302");
  const [label, setLabel] = useState("In-Room Concierge Card");
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>(properties[0]?.id || "");
  const [isDemoLink, setIsDemoLink] = useState(true);
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [showPrintModal, setShowPrintModal] = useState(false);

  const selectedProp = properties.find((p) => p.id === selectedPropertyId);

  // Construct URL with property and room parameters so when walked over, feedback form preselects them
  const url = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedPropertyId) {
      const propParam = selectedProp?.code || selectedPropertyId;
      params.set("property", propParam);
    }
    if (identifier.trim()) {
      params.set("room", identifier.trim());
    }
    if (qrType) {
      params.set("source", `qr_${qrType}`);
    }
    if (isDemoLink) {
      params.set("demo", "true");
    }
    const query = params.toString();
    return `${origin}/feedback${query ? `?${query}` : ""}`;
  }, [origin, selectedPropertyId, selectedProp, identifier, qrType, isDemoLink]);

  useEffect(() => {
    if (!origin) return;
    let active = true;
    setQrDataUrl("");
    QRCode.toDataURL(url, {
      width: 400,
      margin: 2,
      color: {
        dark: "#0b100f",
        light: "#ffffff",
      },
    })
      .then((dataUri) => { if (active) setQrDataUrl(dataUri); })
      .catch((err) => console.error("QR Code generation error:", err));
    return () => { active = false; };
  }, [origin, url]);

  function downloadPng() {
    if (!qrDataUrl) return;
    const link = document.createElement("a");
    link.href = qrDataUrl;
    const propCode = selectedProp?.code?.toLowerCase() || "vistora";
    const cleanId = identifier.toLowerCase().replace(/[^a-z0-9]/g, "-");
    link.download = `vistora-qr-${propCode}-${qrType}-${cleanId}.png`;
    link.click();
  }

  async function downloadSvg() {
    if (!origin) return;
    try {
      const svgString = await QRCode.toString(url, { type: "svg", margin: 2 });
      const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
      const svgUrl = URL.createObjectURL(svgBlob);
      const link = document.createElement("a");
      link.href = svgUrl;
      const propCode = selectedProp?.code?.toLowerCase() || "vistora";
      const cleanId = identifier.toLowerCase().replace(/[^a-z0-9]/g, "-");
      link.download = `vistora-qr-${propCode}-${qrType}-${cleanId}.svg`;
      link.click();
      URL.revokeObjectURL(svgUrl);
    } catch (err) {
      console.error("SVG generation error:", err);
    }
  }

  return (
    <>
      {/* Form Builder Integration Banner */}
      <div
        style={{
          padding: "14px 20px",
          background: "var(--canvas-alt)",
          border: "1px solid var(--line)",
          borderRadius: "8px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "10px",
          marginBottom: "20px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <FileText size={16} style={{ color: "var(--sage)" }} />
          <span style={{ fontSize: "12px", color: "var(--ink)" }}>
            Looking to configure custom questions, translations, or design styles for your QR touchpoints?
          </span>
        </div>
        <Link
          href="/dashboard/forms"
          className="button button-outline"
          style={{ padding: "6px 12px", fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "6px" }}
        >
          <span>Open Form Builder</span>
          <ExternalLink size={12} />
        </Link>
      </div>

      <div className="qr-layout">
        <div className="panel qr-card">
          <p className="eyebrow">Enterprise Touchpoint &amp; QR Studio</p>
          <h2>Physical QR &amp; guest touchpoint studio</h2>
          <p>
            Generate high-resolution QR codes mapped to specific rooms, dining tables, and hotel facilities. When the guest scans or opens the link, the property and touchpoint are pre-selected by default.
          </p>

          {/* QR Touchpoint / Context Selector */}
          <div style={{ marginTop: "20px", marginBottom: "18px" }}>
            <label className="field-label" style={{ display: "block", marginBottom: "8px" }}>
              Touchpoint Type / Context
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
              {[
                { id: "room", label: "In-Room Keycard", defaultId: "Room 302", defaultLabel: "Guest Room Nightstand" },
                { id: "dining", label: "Dining Table", defaultId: "Table 14", defaultLabel: "Restaurant Acrylic Stand" },
                { id: "spa", label: "Spa & Wellness", defaultId: "Lotus Suite", defaultLabel: "Spa Treatment Stand" },
                { id: "reception", label: "Front Desk Kiosk", defaultId: "Check-in Tablet", defaultLabel: "Reception Display" },
                { id: "general", label: "General Property", defaultId: "Main Lobby", defaultLabel: "Keycard Sleeve" },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setQrType(item.id as any);
                    setIdentifier(item.defaultId);
                    setLabel(item.defaultLabel);
                  }}
                  style={{
                    padding: "10px 8px",
                    borderRadius: "6px",
                    border: qrType === item.id ? "2px solid var(--ink)" : "1px solid var(--line)",
                    background: qrType === item.id ? "var(--canvas-alt)" : "var(--panel)",
                    color: "var(--ink)",
                    fontSize: "11px",
                    fontWeight: qrType === item.id ? 700 : 500,
                    cursor: "pointer",
                    textAlign: "center",
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Room / Table Identifier Input */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "18px" }}>
            <div>
              <label className="field-label" style={{ display: "block", marginBottom: "6px" }}>
                {qrType === "room"
                  ? "Room / Suite Number *"
                  : qrType === "dining"
                  ? "Table Number / Outlet *"
                  : qrType === "spa"
                  ? "Treatment Suite *"
                  : "Location Identifier *"}
              </label>
              <input
                className="auth-input"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g. Room 402 or Table 12"
              />
            </div>
            <div>
              <label className="field-label" style={{ display: "block", marginBottom: "6px" }}>
                Placement Campaign Label
              </label>
              <input className="auth-input" value={label} onChange={(e) => setLabel(e.target.value)} />
            </div>
          </div>

          {/* Target Property */}
          <div style={{ marginBottom: "20px" }}>
            <label className="field-label" style={{ display: "block", marginBottom: "6px" }}>
              Target Hotel Property (Pre-fills in Guest Form)
            </label>
            <CustomSelect
              value={selectedPropertyId}
              onChange={(val) => setSelectedPropertyId(val)}
              placeholder="Select property"
              options={properties.map((p) => ({
                value: p.id,
                label: `${p.name} (${p.code})`,
                detail: `${p.location} · ${p.total_rooms || 0} rooms`,
              }))}
            />
          </div>

          {/* Generated URL Box */}
          <div style={{ marginBottom: "20px" }}>
            <label className="field-label" style={{ display: "block", marginBottom: "6px" }}>
              Generated QR Destination Link (With Pre-Selected Room &amp; Hotel)
            </label>
            <input className="auth-input" value={url} readOnly />
          </div>

          {/* Action Buttons: Copy, Walk over to form, Export PNG, Export SVG, Print Voucher PDF */}
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              type="button"
              className="button button-dark"
              disabled={!origin}
              onClick={async () => {
                await navigator.clipboard?.writeText(url);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              <span>{copied ? "Link Copied!" : "Copy URL"}</span>
            </button>

            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="button button-outline"
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <ExternalLink size={14} />
              <span>Walk Over to Form ↗</span>
            </a>

            <button
              type="button"
              className="button button-outline"
              onClick={downloadPng}
              disabled={!qrDataUrl}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <Download size={14} />
              <span>Export PNG</span>
            </button>

            <button
              type="button"
              className="button button-outline"
              onClick={downloadSvg}
              disabled={!origin}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <Download size={14} />
              <span>Export SVG</span>
            </button>

            <button
              type="button"
              className="button button-outline"
              onClick={() => setShowPrintModal(true)}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <Printer size={14} />
              <span>Print Display Card (PDF)</span>
            </button>
          </div>
        </div>

        {/* Live QR Preview Panel */}
        <div
          className="panel qr-preview"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "36px 24px",
            textAlign: "center",
          }}
        >
          {qrDataUrl ? (
            <div
              style={{
                background: "#ffffff",
                padding: "16px",
                borderRadius: "12px",
                border: "1px solid var(--line)",
                boxShadow: "var(--shadow-md)",
              }}
            >
              <img
                src={qrDataUrl}
                alt={`QR Code for ${label}`}
                style={{ width: "200px", height: "200px", display: "block" }}
              />
            </div>
          ) : (
            <div
              style={{
                width: "200px",
                height: "200px",
                display: "grid",
                placeItems: "center",
                border: "1px solid var(--line)",
                borderRadius: "8px",
              }}
            >
              Generating QR…
            </div>
          )}

          <div style={{ marginTop: "18px" }}>
            <strong style={{ fontSize: "15px", display: "block" }}>{identifier || label}</strong>
            <span style={{ fontSize: "11px", color: "var(--muted)", display: "block", marginTop: "2px" }}>
              {label}
            </span>
            {selectedProp && (
              <span
                style={{
                  display: "inline-block",
                  fontSize: "11px",
                  color: "var(--sage-deep)",
                  background: "var(--sage-soft)",
                  padding: "3px 10px",
                  borderRadius: "4px",
                  marginTop: "8px",
                  fontWeight: 600,
                }}
              >
                {selectedProp.name} ({selectedProp.code})
              </span>
            )}
          </div>
          <p style={{ margin: "10px 0 0", color: "var(--muted)", fontSize: "11px" }}>
            Pre-fills hotel location and touchpoint into the guest feedback form.
          </p>
        </div>
      </div>

      {/* Printable Display Voucher / PDF Card Modal */}
      {showPrintModal && (
        <div
          className="drawer-backdrop"
          style={{ display: "grid", placeItems: "center" }}
          onClick={() => setShowPrintModal(false)}
        >
          <div
            style={{
              background: "#ffffff",
              color: "#0b100f",
              borderRadius: "12px",
              padding: "36px",
              maxWidth: "460px",
              width: "90%",
              boxShadow: "var(--shadow-lg)",
              border: "1px solid var(--line)",
              textAlign: "center",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Printable Display Voucher Presentation */}
            <div
              id="printable-hotel-card"
              style={{
                border: "2px solid #254230",
                padding: "24px 20px",
                borderRadius: "8px",
                background: "#fafcfa",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-dm-mono)",
                  fontSize: "10px",
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  color: "#4e6f5b",
                  display: "block",
                  marginBottom: "4px",
                }}
              >
                VISTORA LUXURY HOSPITALITY
              </span>
              <h3 style={{ margin: "0 0 4px", fontSize: "18px", color: "#0b100f" }}>
                {selectedProp?.name || "Vistora Hotels & Resorts"}
              </h3>
              <p style={{ margin: "0 0 16px", fontSize: "11px", color: "#6f7c75" }}>
                Guest Experience &amp; In-Stay Concierge
              </p>

              {qrDataUrl && (
                <img
                  src={qrDataUrl}
                  alt="QR Code"
                  style={{
                    width: "180px",
                    height: "180px",
                    margin: "0 auto 14px",
                    display: "block",
                    padding: "8px",
                    background: "#fff",
                    border: "1px solid #e2e8e2",
                    borderRadius: "6px",
                  }}
                />
              )}

              <div
                style={{
                  display: "inline-block",
                  padding: "4px 14px",
                  borderRadius: "20px",
                  background: "#254230",
                  color: "#ffffff",
                  fontSize: "12px",
                  fontWeight: 600,
                  marginBottom: "8px",
                }}
              >
                {identifier || "Guest Suite"}
              </div>

              <p style={{ margin: "6px 0 0", fontSize: "11px", color: "#4e6f5b", fontWeight: 500 }}>
                Scan with your phone camera to share feedback or request concierge assistance.
              </p>
            </div>

            <div style={{ display: "flex", gap: "10px", marginTop: "20px", justifyContent: "center" }}>
              <button
                type="button"
                className="button button-dark"
                onClick={() => window.print()}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <Printer size={14} />
                <span>Print Card / Save as PDF</span>
              </button>
              <button
                type="button"
                className="button button-outline"
                onClick={() => setShowPrintModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
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
          background: "var(--canvas)",
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
                      <span className="status" style={{ background: "var(--sage-soft)", color: "var(--sage-deep)" }}>
                        {s.avgRating} / 5.0
                      </span>
                    </td>
                    <td>
                      <span style={{ color: s.complaintCount > 0 ? "var(--red)" : "var(--muted)" }}>
                        {s.complaintCount}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div style={{ width: "90px", height: "6px", background: "var(--line)", borderRadius: "3px", overflow: "hidden" }}>
                          <div style={{ width: `${s.recoveryRate}%`, height: "100%", background: "var(--sage-deep)" }} />
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
