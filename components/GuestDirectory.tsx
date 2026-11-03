"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ExternalLink, RefreshCw } from "lucide-react";
import type { WorkspaceUser } from "./Dashboard";
import type { PropertyRow } from "../types/experience";
import type { CollectionStatus, InHouseGuest } from "../lib/feedback/guest-directory";
import { matchesPropertyFilter, useSharedPropertyFilter } from "../lib/platform/propertyFilterStore";
import CustomDatePicker, { isDateInRange, type DateRangeFilter } from "./CustomDatePicker";
import WorkspaceSelect from "./WorkspaceSelect";
import PropertyFilter from "./PropertyFilter";

export default function GuestDirectory({ user, properties, history }: {
  user: WorkspaceUser; properties: PropertyRow[]; history: React.ReactNode;
}) {
  const [view, setView] = useState<"directory" | "history">("directory");
  const [status, setStatus] = useState<CollectionStatus>("pending");
  const [dateRange, setDateRange] = useState<DateRangeFilter>({ preset: "all", startDate: null, endDate: null });
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [resolutionRequest, setResolutionRequest] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState("");
  const allowed = user.isOrganizationAdmin ? null : user.propertyIds?.length ? user.propertyIds : user.propertyId ? [user.propertyId] : [];
  const { selectedIds, singleSelectedId, setSelectedIds } = useSharedPropertyFilter(allowed);
  const query = useQuery<{ guests: InHouseGuest[]; canTakeFeedback: boolean }>({
    queryKey: ["feedback-collection-directory", user.organizationId, user.id, user.rights, status],
    queryFn: async ({ signal }) => {
      const response = await fetch("/api/guest-directory?" + new URLSearchParams({ status }), { signal, cache: "no-store" });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Could not load in-house guests.");
      return json;
    },
    enabled: view === "directory", refetchOnMount: "always", refetchOnWindowFocus: "always", refetchInterval: 30_000,
  });
  const guests = (query.data?.guests || []).filter(guest => matchesPropertyFilter(guest.propertyId, selectedIds) &&
    isDateInRange(guest.collectionStatus === "pending" ? `${guest.checkIn}T00:00:00` : guest.collectionStatus === "collected" ? guest.latestFeedbackAt : guest.checkedOutAt, dateRange) &&
    (!search.trim() || [guest.guestName, guest.roomNumber, guest.propertyName].some(value => value.toLowerCase().includes(search.trim().toLowerCase()))));

  async function takeFeedback(guest: InHouseGuest) {
    setOpening(guest.id); setError("");
    // Open synchronously to keep the browser's popup permission tied to this click.
    const popup = window.open("about:blank", "_blank");
    if (!popup) { setOpening(null); setError("Allow pop-ups for this site to open the guest feedback form."); return; }
    popup.opener = null;
    try {
      const response = await fetch("/api/guest-directory", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stayId: guest.id }) });
      const json = await response.json();
      if (!response.ok || !json.success || typeof json.path !== "string") throw new Error(json.error || "Could not open feedback.");
      popup.location.replace(json.path);
    } catch (error) { popup.close(); setError((error as Error).message); }
    finally { setOpening(null); }
  }
  async function resolveFollowup(guest: InHouseGuest) {
    if (!notes.trim() || saving) return;
    setSaving(true); setError("");
    try {
      let jobId = guest.followup?.id;
      if (!jobId) {
        const response = await fetch("/api/guest-directory", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "followup", stayId: guest.id }) });
        const json = await response.json();
        if (!response.ok || !json.success) throw new Error(json.error || "Could not create follow-up.");
        jobId = json.jobId;
      }
      const response = await fetch("/api/operations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "job_resolve", requestId: resolutionRequest, data: { property_id: guest.propertyId, job_id: jobId, resolution_notes: notes.trim() } }) });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Could not save follow-up.");
      setReviewing(null); setNotes(""); await query.refetch();
    } catch (error) { setError((error as Error).message); }
    finally { setSaving(false); }
  }
  const dateLabel = status === "collected" ? "Feedback date range" : ["missed", "reviewed"].includes(status) ? "Checkout date range" : "Check-in date range";
  const formatTime = (value: string | null) => value ? new Date(value).toLocaleString() : "Not recorded";
  return <div className="platform-page guest-collection-page">
    <header className="page-heading"><div><h1>Collect feedback</h1><p className="subheading">Collect feedback once per stay and follow up on missed checkouts.</p></div></header>
    <nav className="platform-tabs" aria-label="Guest directory views">
      {([['pending', 'In-house · Not taken'], ['missed', 'Checked out · Missing feedback']] as const).map(([value, label]) => <button key={value} aria-current={view === "directory" && status === value ? "page" : undefined} onClick={() => { setStatus(value); setView("directory"); }}>{label}</button>)}
      <Link href="/dashboard/feedback">Collected feedback</Link>
      <button aria-current={view === "history" ? "page" : undefined} onClick={() => setView("history")}>Feedback &amp; invitations</button>
    </nav>
    {view === "history" ? history : <section className="platform-card">
      <div className="guest-collection-toolbar">
        <label style={{flex:"1 1 200px",maxWidth:300}}>Find a guest<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Guest, room, or property"/></label>
        <button className="button button-outline compact" disabled={query.isFetching} onClick={() => query.refetch()}><RefreshCw size={14}/>Refresh</button>
        <div className="guest-collection-filters">
          <div style={{width:190}}><WorkspaceSelect label="Feedback status" value={status} onChange={value => setStatus(value as CollectionStatus)} options={[{value:"pending",label:"Not taken"},{value:"missed",label:"Checkout · Missing"},{value:"reviewed",label:"Checkout · Reviewed"}]}/></div>
          <PropertyFilter properties={allowed === null ? properties : properties.filter(property => allowed.includes(property.id))} selectedId={singleSelectedId} selectedIds={selectedIds} onChange={(id, ids) => setSelectedIds(ids || id)} isGlobalAdmin={user.isOrganizationAdmin === true}/>
          <CustomDatePicker label={dateLabel} value={dateRange} onChange={setDateRange} floating/>
          <button type="button" className="button button-outline filter-reset" onClick={() => { setDateRange({ preset: "all", startDate: null, endDate: null }); setSelectedIds("all"); setSearch(""); }}>Clear filters</button>
        </div>
      </div>
      <p>{status === "pending" ? "In-house guests awaiting feedback. Filter by check-in date range." : "Guests who checked out without feedback. Filter by checkout date range and record the follow-up outcome."} {dateRange.preset === "all" ? "Showing all dates, including checkouts without a recorded time." : "Showing the selected range. Clear filters to see all dates."}</p>
      {(error || query.error) && <p role="alert" className="platform-notice">{error || query.error?.message}</p>}
      {query.isPending ? <p role="status">Loading guests…</p> : !query.error && <>
        {!query.data?.canTakeFeedback && <p>Guest names and personal feedback links require guest-data permission.</p>}
        <div className="platform-table"><table><thead><tr><th>Guest</th><th>Property / room</th><th>Check-in</th><th>Check-out</th><th>Feedback status</th><th>Action / follow-up</th></tr></thead>
          <tbody>{guests.map(guest => <tr key={guest.id}>
            <td>{guest.guestName}</td><td>{guest.propertyName}<small>Room {guest.roomNumber}</small></td><td>{guest.checkIn}</td>
            <td>{(guest.checkedOutAt || ["missed", "reviewed"].includes(guest.collectionStatus)) ? formatTime(guest.checkedOutAt) : guest.checkOut}<small>{(guest.checkedOutAt || ["missed", "reviewed"].includes(guest.collectionStatus)) ? "Actual checkout" : "Scheduled"}</small></td>
            <td>{guest.collectionStatus === "collected" ? <>Feedback collected<small>{formatTime(guest.latestFeedbackAt)}</small></> : guest.collectionStatus === "pending" ? "Not taken" : guest.collectionStatus === "reviewed" ? "Missing · Follow-up reviewed" : "Missing at checkout"}</td>
            <td>{guest.collectionStatus === "pending" && query.data?.canTakeFeedback && <button className="button button-outline compact" disabled={opening !== null} onClick={() => takeFeedback(guest)}><ExternalLink size={13}/>{opening === guest.id ? "Opening…" : "Take feedback"}</button>}
              {guest.followup && <><small>Assigned to {guest.followup.assignedName || "management"}</small>{guest.followup.resolutionNotes && <p style={{whiteSpace:"pre-wrap"}}>{guest.followup.resolutionNotes}</p>}</>}
              {guest.collectionStatus === "missed" && (reviewing === guest.id ? <form onSubmit={event => { event.preventDefault(); void resolveFollowup(guest); }}>
                <label>Why was feedback missed? Record follow-up outcome.<textarea required maxLength={2000} value={notes} disabled={saving} onChange={event => { setNotes(event.target.value); setResolutionRequest(crypto.randomUUID()); }}/></label>
                <button className="button button-primary compact" disabled={saving || !notes.trim()}>{saving ? "Saving…" : "Save review"}</button>{" "}
                <button type="button" className="button button-outline compact" disabled={saving} onClick={() => setReviewing(null)}>Cancel</button>
              </form> : guest.canReviewFollowup ? <button className="button button-outline compact" onClick={() => { setReviewing(guest.id); setNotes(""); setResolutionRequest(crypto.randomUUID()); }}>Review missed feedback</button> : <small>Management or the assigned staff member must review this checkout.</small>)}
            </td></tr>)}</tbody></table></div>
        {!guests.length && <p>No guests match these filters.</p>}
      </>}
    </section>}
  </div>;
}
