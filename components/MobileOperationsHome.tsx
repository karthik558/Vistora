"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell, type WorkspaceUser } from "./Dashboard";
import { useSharedPropertyFilter } from "../lib/platform/propertyFilterStore";
import { ArrowUpRight, Bell, CheckCheck, ClipboardList, Clock3, BedDouble, Users, UserRoundCheck, MessageSquare, RefreshCw, AlertTriangle, ChevronRight } from "lucide-react";
import { hasModuleAccess } from "../lib/auth/modules";
import WorkspaceSelect from "./WorkspaceSelect";

type Alert = { id: string; title: string; department: string; priority: string; escalation_level: number; due_at: string; assigned_to: string | null; acknowledged_at: string | null };
type Summary = { property: string; properties: { id: string; name: string }[]; active: number; resolved: number; escalated: number; feedback: number | null; mine: number; overdue: number; cleaning: number; inHouse: number; alerts: Alert[] };
export function ServiceOverviewContent({ data, property, setProperty, loading, error, refresh, canViewFeedback }: {
  data: Summary | null; property: string; setProperty: (value: string) => void; loading: boolean; error: string; refresh: () => void; canViewFeedback: boolean;
}) {
  const jobs = (view: string) => "/dashboard/hospitality?" + new URLSearchParams({ section: "Service jobs", property, jobs: view });
  const section = (name: string) => "/dashboard/hospitality?" + new URLSearchParams({ section: name, property });
  const tiles = [
    { label: "Service requests", value: data?.active, detail: "Open & in progress", tone: "blue", icon: ClipboardList, href: jobs("all") },
    { label: "Resolved", value: data?.resolved, detail: "Completed · all time", tone: "green", icon: CheckCheck, href: jobs("resolved") },
    { label: "Escalated", value: data?.escalated, detail: "Active escalations", tone: "rose", icon: AlertTriangle, href: jobs("escalated") },
    { label: "My tasks", value: data?.mine, detail: "Assigned to you", tone: "teal", icon: UserRoundCheck, href: jobs("mine") },
    { label: "Overdue", value: data?.overdue, detail: "Past the response target", tone: "amber", icon: Clock3, href: jobs("overdue") },
    ...(canViewFeedback ? [{ label: "Feedback", value: data?.feedback, detail: "Received · all time", tone: "violet", icon: MessageSquare, href: "/dashboard/feedback" }] : []),
    { label: "Rooms to clean", value: data?.cleaning, detail: "Marked dirty", tone: "blue", icon: BedDouble, href: section("Cleaning") },
    { label: "In-house stays", value: data?.inHouse, detail: "Active guest stays", tone: "teal", icon: Users, href: section("Guests") },
  ];
  return <main className="mobile-operations-home">
    <h1 className="sr-only">Service overview</h1>
    <div className="mobile-overview-toolbar"><div className="mobile-overview-property"><WorkspaceSelect label="Property" value={property} onChange={setProperty} options={[{ value: "all", label: "All properties" }, ...(data?.properties || []).map(p => ({ value: p.id, label: p.name }))]}/></div><button type="button" className="mobile-overview-refresh" disabled={loading} onClick={refresh} aria-label="Refresh service overview"><RefreshCw size={19} className={loading ? "is-syncing" : ""}/></button></div>
    {error && <div role="alert" className="mobile-overview-error"><AlertTriangle size={18}/><span>{error}</span><button type="button" disabled={loading} onClick={refresh}>Retry</button></div>}
    <section className="mobile-operations-tiles" aria-label="Service summary" aria-busy={loading}>
      {tiles.map(tile => { const Icon = tile.icon; return <Link key={tile.label} href={tile.href} className={`mobile-overview-tile tone-${tile.tone}`}><div className="mobile-tile-heading"><span className="mobile-tile-icon"><Icon size={21} strokeWidth={1.8}/></span><ArrowUpRight size={16} aria-hidden="true"/></div><strong>{tile.value ?? "—"}</strong><span className="mobile-tile-label">{tile.label}</span><small>{tile.detail}</small></Link>; })}
    </section>
    <section className="mobile-attention" aria-labelledby="mobile-attention-title"><div className="mobile-attention-heading"><span className="mobile-attention-icon"><Bell size={19}/></span><h2 id="mobile-attention-title">Needs attention</h2><Link href={jobs("all")}>View requests<ChevronRight size={15}/></Link></div>
      {!data ? <p className="mobile-attention-empty" role="status">{loading ? "Checking for alerts…" : "Alerts could not be loaded. Tap refresh to try again."}</p> : data.alerts.length === 0 ? <div className="mobile-attention-empty"><CheckCheck size={24}/><p>You're all caught up</p><small>No overdue work, escalations, or requests waiting for your acknowledgement.</small></div> : <div className="mobile-attention-list">{data.alerts.map(alert => {
        const overdue = Date.parse(alert.due_at) < Date.now();
        const text = alert.escalation_level > 0 ? `Escalation level ${alert.escalation_level}` : overdue ? "Overdue" : "Awaiting acknowledgement";
        return <Link href={jobs(alert.escalation_level > 0 ? "escalated" : overdue ? "overdue" : "mine")} key={alert.id}><span className={`mobile-alert-dot ${overdue || alert.escalation_level ? "is-urgent" : ""}`} aria-hidden="true"/><div><strong>{alert.title}</strong><small>{alert.department} · {text}</small></div><ChevronRight size={17} aria-hidden="true"/></Link>;
      })}</div>}
    </section>
    <p className="mobile-overview-sync" role="status"><span aria-hidden="true"/>{loading ? "Updating…" : error ? "Refresh needed" : "Auto-refreshes every 30 seconds"}</p>
  </main>;
}
export default function MobileOperationsHome({ user }: { user: WorkspaceUser }) {
  const allowed = user.isOrganizationAdmin ? null : user.propertyIds?.length ? user.propertyIds : user.propertyId ? [user.propertyId] : [];
  const { singleSelectedId: property, setSelectedIds: setProperty } = useSharedPropertyFilter(allowed);
  const [data, setData] = useState<Summary | null>(null), [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0), [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
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
  const canViewFeedback = !!user.isOrganizationAdmin || (hasModuleAccess(user, "feedback") && !!user.rights?.includes("view_feedback"));
  return <AppShell user={user} active="Overview" module="operations"><ServiceOverviewContent data={data?.property === property ? data : null} property={property} setProperty={setProperty} loading={loading} error={error} refresh={() => setRefresh(n => n + 1)} canViewFeedback={canViewFeedback}/></AppShell>;
}
