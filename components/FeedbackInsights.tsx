"use client";

import { useEffect, useMemo, useState } from "react";
import { MessageSquareText, ScanText, CheckCheck } from "lucide-react";
import DashboardPageHeading from "./DashboardPageHeading";
import { FeedbackTable, type WorkspaceUser } from "./Dashboard";
import type { DashboardData, FeedbackViewModel } from "../types/experience";
import CustomDatePicker, { isDateInRange, type DateRangeFilter } from "./CustomDatePicker";
import PropertyFilter from "./PropertyFilter";
import { useSharedPropertyFilter } from "../lib/platform/propertyFilterStore";
import { needsFollowUp, prioritizeFollowUps, type FollowUpView } from "../lib/feedback/insights";

const views: { id: FollowUpView; label: string }[] = [
  { id: "all", label: "Needs follow-up" }, { id: "overdue", label: "Overdue" },
  { id: "contact", label: "Contact requested" }, { id: "unacknowledged", label: "Awaiting acknowledgement" },
  { id: "unassigned", label: "Unassigned" },
];

export default function FeedbackInsights({ data, user }: { data: DashboardData; user: WorkspaceUser }) {
  const isSuperAdminUser = user.isOrganizationAdmin || ["super_admin", "general_manager"].includes(user.orgRole || "");
  const userAllowedPropIds = isSuperAdminUser
    ? null
    : user.propertyIds?.length
    ? user.propertyIds
    : user.propertyId
    ? [user.propertyId]
    : [];

  const { selectedIds, setSelectedIds, matches } = useSharedPropertyFilter(userAllowedPropIds);
  const [date, setDate] = useState<DateRangeFilter>({ preset: "all", startDate: null, endDate: null });
  const [view, setView] = useState<FollowUpView>("all");
  const [query, setQuery] = useState("");
  const [updates, setUpdates] = useState<Record<string, FeedbackViewModel>>({});
  useEffect(() => { setUpdates({}); }, [data]);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const timer = window.setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(timer); }, []);
  const rows = useMemo(() => {
    const department = user.rights?.find(right => right.startsWith("dept_scope:"))?.slice(11).trim();
    const unrestrictedDepartment = user.isOrganizationAdmin || ["super_admin", "general_manager"].includes(user.orgRole || "");
    return data.recentFeedback.map(row => updates[row.id] || row).filter(row => matches(row.propertyId)
      && (user.isOrganizationAdmin || (user.propertyIds || (user.propertyId ? [user.propertyId] : [])).includes(row.propertyId || ""))
      && (unrestrictedDepartment || !department || ["*", "All Departments"].includes(department) || row.department === department)
      && isDateInRange(row.createdAt, date)
      && `${row.name} ${row.roomNumber} ${row.department} ${row.comment || ""}`.toLowerCase().includes(query.toLowerCase()));
  }, [data, updates, user, matches, date, query]);
  const visible = now === null ? [] : prioritizeFollowUps(rows.filter(row => needsFollowUp(row, view, now)), now);
  const comments = rows.filter(row => row.comment?.trim()).length;
  const resolved = rows.filter(row => row.status === "resolved").length;
  return <div className="content-wrap feedback-intelligence">
    <DashboardPageHeading eyebrow="Guest experience operations" title="Follow-up queue" description="Prioritize guest contact requests and feedback that needs a response.">
    <div className="fi-toolbar"><PropertyFilter properties={userAllowedPropIds ? data.properties.filter(p => userAllowedPropIds.includes(p.id)) : data.properties} selectedIds={selectedIds} onChange={(id, ids) => setSelectedIds(ids || [id])} isGlobalAdmin={isSuperAdminUser} /><CustomDatePicker value={date} onChange={setDate} /><button className="button button-outline" onClick={() => { setSelectedIds(["all"]); setDate({ preset: "all", startDate: null, endDate: null }); setView("all"); setQuery(""); }}>Reset filters</button></div>
    </DashboardPageHeading>
    <div className="fi-summary">
      <article><MessageSquareText size={20} /><span>Feedback in this view</span><strong>{rows.length}</strong><small>Matches property, date and search</small></article>
      <article><ScanText size={20} /><span>Guest comments</span><strong>{comments}</strong><small>Written feedback to learn from</small></article>
      <article><CheckCheck size={20} /><span>Resolved feedback</span><strong>{resolved}</strong><small>{rows.length ? Math.round(resolved / rows.length * 100) + "% of this view" : "No feedback yet"}</small></article>
    </div>
    <section className="fi-panel"><h2>Make the next response count</h2><p>Overdue first, then escalations and contact requests; oldest first within each group. Resolved feedback stays out of every queue.</p><div className="fi-chips" aria-label="Follow-up queues">{views.map(item => <button key={item.id} aria-pressed={view === item.id} onClick={() => setView(item.id)}>{item.label}<span>{now === null ? "—" : rows.filter(row => needsFollowUp(row, item.id, now)).length}</span></button>)}</div></section>

    <p className="fi-results" aria-live="polite">{visible.length} matching responses. Open a record to review the guest’s feedback.</p>
    <FeedbackTable onRecordUpdate={record => setUpdates(previous => ({ ...previous, [record.id]: record }))} feedback={visible} title="Follow-up queue" searchQuery={query} onSearchChange={setQuery} />
  </div>;
}
