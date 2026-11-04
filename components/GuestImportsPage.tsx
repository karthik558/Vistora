"use client";
import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import GuestDirectory from "./GuestDirectory";
import type { WorkspaceUser } from "./Dashboard";
import { hasModuleAccess } from "../lib/auth/modules";
export type ImportChange = { room_number: string; guest_name: string; check_in_date: string; check_out_date: string; action: string; stay_id?: string };
export type ImportResult = { token: string; changes: ImportChange[]; imported: { total: number; staysCreated: number; staysUpdated: number; checkedOut: number } };
export function ImportChanges({ changes }: { changes: ImportChange[] }) {
  return <div className="platform-table" style={{ maxHeight: 300, overflow: "auto" }}><table>
    <thead><tr><th>Room</th><th>Guest</th><th>Check-in</th><th>Scheduled check-out</th><th>Report result</th></tr></thead>
    <tbody>{changes.map((change, index) => <tr key={index}><td>{change.room_number}</td><td>{change.guest_name}</td><td>{change.check_in_date}</td><td>{change.check_out_date}</td><td>{change.action}</td></tr>)}</tbody>
  </table></div>;
}
export default function GuestImportsPage({ user, property, properties, revision }: { user: WorkspaceUser; property: string; properties: { id: string; name: string }[]; revision: number }) {
  const [client] = useState(() => new QueryClient());
  const [selectedImport, setSelectedImport] = useState<string | null>(null);
  const canViewForms = hasModuleAccess(user, "feedback") && (user.isOrganizationAdmin || user.rights?.includes("view_feedback"));
  const [imports, setImports] = useState<{ id: string; property_id: string; mode: string; source_name: string | null; created_at: string; result: ImportResult }[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(""); setSelectedImport(null);
    fetch("/api/hospitality/import?" + new URLSearchParams({ property }), { signal: controller.signal, cache: "no-store" }).then(async response => {
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Could not load import history.");
      setImports(result.imports);
    }).catch(error => { if (!controller.signal.aborted) setError(error.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [property, revision]);
  return <section className="platform-card"><h2>Occupancy reports</h2><p>Upload multiple reports throughout the day. Full reports reconcile all in-house stays at one property; partial reports update only the rooms you select.</p>
    <h3>Recent imports</h3>{error && <p role="alert">{error}</p>}{loading ? <p role="status">Loading reports…</p> : !error && imports.length === 0 ? <p>No reports imported yet.</p> : !error && imports.map(item => <details key={item.id} style={{ padding: "14px 0", borderBottom: "1px solid var(--line)" }}><summary>{item.source_name || "Earlier report"} · {new Date(item.created_at).toLocaleString()} · {properties.find(p => p.id === item.property_id)?.name || "Property"} · {item.mode === "full" ? "Full report" : "Partial update"} · {item.result.imported.total} rooms · {item.result.imported.checkedOut} check-outs</summary><ImportChanges changes={item.result.changes}/>
      {canViewForms && item.result.changes.some(change => !change.stay_id) && <p>Some earlier report rows have no stay link. Find those guests in Collect feedback.</p>}
      {canViewForms && (item.result.changes.some(change => change.stay_id) ? <button type="button" className="button button-outline" onClick={() => setSelectedImport(item.id)}>View linked forms and feedback status</button> : null)}
      {selectedImport === item.id && <QueryClientProvider client={client}><GuestDirectory key={item.id} user={user} properties={properties} importId={item.id}/></QueryClientProvider>}
    </details>)}
    <p>Forms are available for active stays. Reservations appear after check-in. Status refreshes every 30 seconds and when you return to the page.</p>
    <p>Showing the latest 30 imports. Check-outs also remain in guest stay history.</p>
  </section>;
}
