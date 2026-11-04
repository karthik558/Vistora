"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell, type WorkspaceUser } from "./Dashboard";
import { useSharedPropertyFilter } from "../lib/platform/propertyFilterStore";
import WorkspaceSelect from "./WorkspaceSelect";

type Summary = { property: string; properties: { id: string; name: string }[]; active: number; resolved: number; escalated: number; feedback: number | null };
export default function MobileOperationsHome({ user }: { user: WorkspaceUser }) {
  const allowed = user.isOrganizationAdmin ? null : user.propertyIds?.length ? user.propertyIds : user.propertyId ? [user.propertyId] : [];
  const { singleSelectedId: property, setSelectedIds: setProperty } = useSharedPropertyFilter(allowed);
  const [data, setData] = useState<Summary | null>(null), [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0), [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setLoading(true); setError("");
    let sequence = 0;
    async function load() {
      const ticket = ++sequence;
      try {
        const response = await fetch("/api/operations/summary?" + new URLSearchParams({ property }), { signal: controller.signal, cache: "no-store" });
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || "Could not load operations.");
        if (!controller.signal.aborted && ticket === sequence) { setData({ ...json, property }); setError(""); }
      } catch (error) { if (!controller.signal.aborted && ticket === sequence) setError((error as Error).message); }
      finally { if (!controller.signal.aborted && ticket === sequence) setLoading(false); }
    }
    void load();
    const timer = setInterval(() => { if (!document.hidden) void load(); }, 30000);
    const focus = () => { void load(); };
    window.addEventListener("focus", focus); window.addEventListener("online", focus);
    return () => { controller.abort(); clearInterval(timer); window.removeEventListener("focus", focus); window.removeEventListener("online", focus); };
  }, [property, refresh]);
  const jobs = (view: string) => "/dashboard/hospitality?" + new URLSearchParams({ section: "Service jobs", property, jobs: view });
  return <AppShell user={user} active="Overview" module="operations"><main className="mobile-operations-home">
    <p className="eyebrow">HOTEL OPERATIONS</p><h1>Your service overview</h1><p>Open a tile to view the work. Request lists show recent records. Counts cover your authorized properties.</p>
    <div className="ops-section-heading"><WorkspaceSelect label="Property" value={property} onChange={setProperty} options={[{ value: "all", label: "All assigned properties" }, ...(data?.properties || []).map(p => ({ value: p.id, label: p.name }))]}/><button type="button" className="button button-outline" disabled={loading} onClick={() => setRefresh(n => n + 1)}>Refresh</button></div>
    {error && <p role="alert">{error}</p>}{loading && <p role="status">Loading summary…</p>}
    {data?.property === property && <><div className="mobile-operations-tiles">
      <Link href={jobs("all")}><strong>{data.active}</strong><span>Service requests available</span><small>Open and in progress</small></Link>
      <Link href={jobs("resolved")}><strong>{data.resolved}</strong><span>Resolved requests</span><small>Completed · all time</small></Link>
      <Link href={jobs("escalated")}><strong>{data.escalated}</strong><span>Escalated requests</span><small>Active · escalation level above zero</small></Link>
      {data.feedback !== null && <Link href="/dashboard/feedback"><strong>{data.feedback}</strong><span>Feedback received</span><small>All time · use feedback filters for details</small></Link>}
    </div><p role="status">Updates every 30 seconds.</p></>}
    <Link className="button button-outline" href={"/dashboard/hospitality?" + new URLSearchParams({ property })}>Full hotel operations</Link>{" "}<Link href="/dashboard?modules=1">All modules</Link>
  </main></AppShell>;
}
