"use client";
import { useEffect, useState } from "react";
export type ImportChange = { room_number: string; guest_name: string; check_in_date: string; check_out_date: string; action: string };
export type ImportResult = { token: string; changes: ImportChange[]; imported: { total: number; staysCreated: number; staysUpdated: number; checkedOut: number } };
export function ImportChanges({ changes }: { changes: ImportChange[] }) {
  return <div className="platform-table" style={{ maxHeight: 300, overflow: "auto" }}><table>
    <thead><tr><th>Room</th><th>Guest</th><th>Check-in</th><th>Scheduled check-out</th><th>Report result</th></tr></thead>
    <tbody>{changes.map((change, index) => <tr key={index}><td>{change.room_number}</td><td>{change.guest_name}</td><td>{change.check_in_date}</td><td>{change.check_out_date}</td><td>{change.action}</td></tr>)}</tbody>
  </table></div>;
}
export default function GuestImportsPage({ property, properties, revision }: { property: string; properties: { id: string; name: string }[]; revision: number }) {
  const [imports, setImports] = useState<{ id: string; property_id: string; mode: string; created_at: string; result: ImportResult }[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError("");
    fetch("/api/hospitality/import?" + new URLSearchParams({ property }), { signal: controller.signal, cache: "no-store" }).then(async response => {
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Could not load import history.");
      setImports(result.imports);
    }).catch(error => { if (!controller.signal.aborted) setError(error.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [property, revision]);
  return <section className="platform-card"><h2>Occupancy reports</h2><p>Upload multiple reports throughout the day. Full reports reconcile all in-house stays at one property; partial reports update only the rooms you select.</p>
    <h3>Recent imports</h3>{error && <p role="alert">{error}</p>}{loading ? <p role="status">Loading reports…</p> : !error && imports.length === 0 ? <p>No reports imported yet.</p> : !error && imports.map(item => <details key={item.id} style={{ padding: "14px 0", borderBottom: "1px solid var(--line)" }}><summary>{new Date(item.created_at).toLocaleString()} · {properties.find(p => p.id === item.property_id)?.name || "Property"} · {item.mode === "full" ? "Full report" : "Partial update"} · {item.result.imported.total} rooms · {item.result.imported.checkedOut} check-outs</summary><ImportChanges changes={item.result.changes}/></details>)}
    <p>Showing the latest 30 imports. Check-outs also remain in guest stay history.</p>
  </section>;
}
