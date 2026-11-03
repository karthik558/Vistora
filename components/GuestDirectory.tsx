"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, RefreshCw } from "lucide-react";
import type { WorkspaceUser } from "./Dashboard";
import type { PropertyRow } from "../types/experience";
import type { InHouseGuest } from "../lib/feedback/guest-directory";
import { matchesPropertyFilter, useSharedPropertyFilter } from "../lib/platform/propertyFilterStore";
import PropertyFilter from "./PropertyFilter";

export default function GuestDirectory({ user, properties, history }: {
  user: WorkspaceUser; properties: PropertyRow[]; history: React.ReactNode;
}) {
  const [view, setView] = useState<"in-house" | "history">("in-house");
  const [search, setSearch] = useState("");
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState("");
  const allowed = user.isOrganizationAdmin ? null : user.propertyIds?.length ? user.propertyIds : user.propertyId ? [user.propertyId] : [];
  const { selectedIds, singleSelectedId, setSelectedIds } = useSharedPropertyFilter(allowed);
  const query = useQuery<{ guests: InHouseGuest[]; canTakeFeedback: boolean }>({
    queryKey: ["in-house-feedback-directory", user.organizationId, user.id, user.rights],
    queryFn: async ({ signal }) => {
      const response = await fetch("/api/guest-directory", { signal, cache: "no-store" });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Could not load in-house guests.");
      return json;
    },
    enabled: view === "in-house", refetchOnMount: "always", refetchInterval: 30_000,
  });
  const guests = (query.data?.guests || []).filter(guest => matchesPropertyFilter(guest.propertyId, selectedIds) &&
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
  return <div className="platform-page">
    <header className="page-heading"><div><h1>Guest directory</h1><p className="subheading">Collect feedback from current stays, or review past feedback and invitations.</p></div></header>
    <nav className="platform-tabs" aria-label="Guest directory views">
      <button aria-current={view === "in-house" ? "page" : undefined} onClick={() => setView("in-house")}>In-house guests</button>
      <button aria-current={view === "history" ? "page" : undefined} onClick={() => setView("history")}>Feedback &amp; invitations</button>
    </nav>
    {view === "history" ? history : <section className="platform-card">
      <div className="platform-actions" style={{ flexWrap: "wrap", alignItems: "flex-end", gap: 12, marginBottom: 18 }}>
        <label style={{flex:"1 1 220px",maxWidth:320}}>Find a guest<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Guest, room, or property"/></label>
        <PropertyFilter properties={allowed === null ? properties : properties.filter(property => allowed.includes(property.id))} selectedId={singleSelectedId} selectedIds={selectedIds} onChange={(id, ids) => setSelectedIds(ids || id)}/>
        <button className="button button-outline compact" disabled={query.isFetching} onClick={() => query.refetch()}><RefreshCw size={14}/>Refresh</button>
      </div>
      <p>Current stays from Hotel operations, including daily imports. Feedback is linked to the selected stay and property.</p>
      {(error || query.error) && <p role="alert" className="platform-notice">{error || query.error?.message}</p>}
      {query.isPending ? <p role="status">Loading in-house guests…</p> : !query.error && <>
        {!query.data?.canTakeFeedback && <p>Guest names and personal feedback links require guest-data permission.</p>}
        <div className="platform-table"><table><thead><tr><th>Guest</th><th>Property / room</th><th>Check-in</th><th>Scheduled check-out</th><th>Feedback for this stay</th><th>Action</th></tr></thead>
          <tbody>{guests.map(guest => <tr key={guest.id}><td>{guest.guestName}</td><td>{guest.propertyName}<small>Room {guest.roomNumber}</small></td><td>{guest.checkIn}</td><td>{guest.checkOut}</td><td>{guest.feedbackCount ? `${guest.feedbackCount} response${guest.feedbackCount === 1 ? "" : "s"}` : "Awaiting feedback"}</td><td>{query.data?.canTakeFeedback && <button className="button button-outline compact" disabled={opening !== null} onClick={() => takeFeedback(guest)}><ExternalLink size={13}/>{opening === guest.id ? "Opening…" : "Take feedback"}</button>}</td></tr>)}</tbody></table></div>
        {!guests.length && <p>No matching in-house stays. Imported reservations appear here after check-in.</p>}
      </>}
    </section>}
  </div>;
}
