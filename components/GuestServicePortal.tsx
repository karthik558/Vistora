"use client";
import { useEffect, useRef, useState } from "react";
import { guestServices } from "../lib/omniops/types";
import { Status } from "./OperationsUI";
export default function GuestServicePortal({ token }: { token: string }) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(""),
    [message, setMessage] = useState("");
  const lock = useRef(false);
  const pending = useRef<{ service: string; id: string } | null>(null);
  async function load() {
    const response = await fetch(
      "/api/guest-services/" + encodeURIComponent(token),
      { cache: "no-store" },
    );
    const body = await response.json();
    if (!response.ok)
      throw new Error(body.error || "Guest services are unavailable.");
    setData(body);
  }
  useEffect(() => {
    let active = true;
    load().catch((e) => {
      if (active) setError(e.message);
    });
    const timer = setInterval(() => {
      if (!document.hidden) load().catch(() => {});
    }, 30000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [token]);
  async function request(service: string) {
    if (lock.current) return;
    lock.current = true;
    setBusy(service);
    setError("");
    setMessage("");
    if (pending.current?.service !== service)
      pending.current = { service, id: crypto.randomUUID() };
    try {
      if (!navigator.onLine) throw new Error("Reconnect to send your request.");
      const response = await fetch(
        "/api/guest-services/" + encodeURIComponent(token),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ service, requestId: pending.current.id }),
        },
      );
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || "The request was not sent.");
      pending.current = null;
      setMessage("Your request has been sent to the hotel team.");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      lock.current = false;
      setBusy("");
    }
  }
  return (
    <main className="ops-guest-portal platform-page">
      <header>
        <img src="/vistora_logo_blue.webp" alt="Vistora" width={132} />
        <p className="eyebrow">GUEST SERVICES</p>
        <h1>{data?.property || "Welcome"}</h1>
        {data && <p>Room {data.room} · Let us know what you need.</p>}
      </header>
      {error && (
        <p className="platform-notice" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="hotel-success" role="status">
          {message}
        </p>
      )}
      {!data && !error && <p role="status">Loading guest services…</p>}
      {data && (
        <>
          <section
            className="ops-guest-services"
            aria-label="Available services"
          >
            {guestServices.map((s) => (
              <button
                key={s.value}
                disabled={!!busy}
                onClick={() => request(s.value)}
              >
                {busy === s.value ? "Sending…" : s.label}
                <span>Request</span>
              </button>
            ))}
          </section>
          <section className="platform-card">
            <h2>Your recent requests</h2>
            {!data.requests.length ? (
              <p>No requests yet.</p>
            ) : (
              <div className="ops-simple-list">
                {data.requests.map((r: any) => (
                  <div key={r.id}>
                    <span>
                      {guestServices.find((s) => s.value === r.service)?.label}
                    </span>
                    <Status value={r.service_jobs?.status || "open"} />
                  </div>
                ))}
              </div>
            )}
          </section>
          <p>
            For urgent assistance, please contact reception directly. Room
            service requests are sent to the team for confirmation; no charges
            are applied here.
          </p>
        </>
      )}
    </main>
  );
}
