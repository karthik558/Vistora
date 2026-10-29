"use client";
import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useReducedMotion } from "framer-motion";
import { BellRing, Search } from "lucide-react";
import type { WorkspaceUser } from "./Dashboard";
import { departments, Job, OperationsData } from "../lib/omniops/types";
import { Dialog, Empty, Mutate, RoomLabel, Status } from "./OperationsUI";
import { canManageServiceJobs } from "../lib/operations/access";

export function deadlineLabel(due: string, now: number) {
  const seconds = Math.ceil((Date.parse(due) - now) / 1000),
    abs = Math.abs(seconds);
  if (!Number.isFinite(abs)) return "No deadline";
  return `${Math.floor(abs / 3600) ? Math.floor(abs / 3600) + "h " : ""}${Math.floor((abs % 3600) / 60)}m ${abs % 60}s ${seconds < 0 ? "overdue" : "left"}`;
}
export function SlideAction({
  label,
  onComplete,
  disabled,
}: {
  label: string;
  onComplete: () => void;
  disabled: boolean;
}) {
  const x = useMotionValue(0),
    track = useRef<HTMLDivElement>(null),
    [distance, setDistance] = useState(200);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!track.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setDistance(Math.max(40, entry.contentRect.width - 52)),
    );
    observer.observe(track.current);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={track} className="ops-slide">
      <span>Slide to {label.toLowerCase()}</span>
      <motion.button
        type="button"
        className="ops-slide-handle"
        style={{ x, touchAction: "pan-y" }}
        drag={disabled ? false : "x"}
        dragConstraints={{ left: 0, right: distance }}
        dragElastic={0}
        dragMomentum={false}
        onDragEnd={() => {
          if (x.get() >= distance * 0.8 && !disabled) onComplete();
          x.set(0);
        }}
        onClick={(e) => {
          if (e.detail === 0 && !disabled) onComplete();
        }}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !disabled) {
            e.preventDefault();
            onComplete();
          }
        }}
        disabled={disabled}
        aria-label={label}
        title={`${label} · slide or press Enter`}
        whileTap={reduced ? undefined : { scale: 0.97 }}
      >
        →
      </motion.button>
    </div>
  );
}
export default function OperationsJobBoard({
  data,
  user,
  mutate,
  busy,
  onCreate,
  onClean,
  onResolve,
  compact = false,
  error,
}: {
  data: OperationsData;
  user: WorkspaceUser;
  mutate: Mutate;
  busy: boolean;
  onCreate: () => void;
  onClean: (job: Job) => void;
  onResolve: (job: Job) => void;
  compact?: boolean;
  error?: string;
}) {
  const [cancel, setCancel] = useState<Job | null>(null);
  const [dept, setDept] = useState("all"),
    [view, setView] = useState(user.isOrganizationAdmin ? "all" : "mine"),
    [search, setSearch] = useState(""),
    [now, setNow] = useState(Date.now()),
    [urgent, setUrgent] = useState<Job | null>(null),
    [alerts, setAlerts] = useState(false),
    [pushState, setPushState] = useState("");
  const seen = useRef(new Set<string>()),
    audio = useRef<AudioContext | null>(null);
  const canAttend = canManageServiceJobs(user);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(
    () => () => {
      audio.current?.close();
    },
    [],
  );
  useEffect(() => {
    const assigned = data.jobs.filter(
      (j) =>
        j.assigned_to === user.id && j.status === "open" && !j.acknowledged_at,
    );
    const fresh = assigned.filter((j) => !seen.current.has(j.id));
    assigned.forEach((j) => seen.current.add(j.id));
    const severe = fresh.find(
      (j) => j.priority === "critical" || Date.parse(j.due_at) < Date.now(),
    );
    if (severe) {
      setUrgent(severe);
      if (alerts) {
        navigator.vibrate?.([200, 100, 200]);
        try {
          const context = audio.current;
          if (context) {
            const tone = context.createOscillator(),
              gain = context.createGain();
            tone.connect(gain);
            gain.connect(context.destination);
            gain.gain.value = 0.08;
            tone.frequency.value = 660;
            tone.start();
            tone.stop(context.currentTime + 0.35);
          }
        } catch {}
      }
    }
  }, [data.jobs, user.id, alerts]);
  useEffect(() => {
    if (
      urgent &&
      !data.jobs.some(
        (j) =>
          j.id === urgent.id &&
          j.status === "open" &&
          !j.acknowledged_at &&
          j.assigned_to === user.id,
      )
    )
      setUrgent(null);
  }, [data.jobs, urgent, user.id]);
  const filtered = data.jobs
    .filter(
      (j) =>
        (view === "history"
          ? ["completed", "cancelled"].includes(j.status)
          : !["completed", "cancelled"].includes(j.status)) &&
        (dept === "all" || j.department === dept) &&
        (view === "all" ||
          view === "history" ||
          (view === "mine" && j.assigned_to === user.id) ||
          (view === "overdue" && Date.parse(j.due_at) < now) ||
          (view === "unassigned" && !j.assigned_to)) &&
        (!search ||
          [
            j.title,
            j.location,
            j.department,
            data.rooms.find((r) => r.id === j.room_id)?.room_number,
          ]
            .join(" ")
            .toLowerCase()
            .includes(search.toLowerCase())),
    )
    .sort((a, b) => {
      if (view === "history")
        return (
          Date.parse(b.completed_at || b.updated_at || b.created_at) -
          Date.parse(a.completed_at || a.updated_at || a.created_at)
        );
      const priority: Record<string, number> = {
        critical: 0,
        high: 1,
        normal: 2,
        low: 3,
      };
      return (
        Number(Date.parse(b.due_at) < now) -
          Number(Date.parse(a.due_at) < now) ||
        (priority[a.priority] ?? 2) - (priority[b.priority] ?? 2) ||
        Date.parse(a.due_at) - Date.parse(b.due_at)
      );
    });
  const attend = (j: Job) =>
    user.isOrganizationAdmin || (canAttend && j.assigned_to === user.id);
  async function act(j: Job) {
    if (!j.acknowledged_at) {
      await mutate("job", { id: j.id, acknowledge: true }, true);
    } else if (j.status === "open") {
      await mutate("job", { id: j.id, status: "in_progress" }, true);
    } else if (j.kind === "cleaning" && j.room_id) {
      onClean(j);
    } else {
      onResolve(j);
    }
  }
  const actionLabel = (j: Job) =>
    !j.acknowledged_at
      ? "Acknowledge"
      : j.status === "open"
        ? "Start job"
        : j.kind === "cleaning" && j.room_id
          ? "Complete cleaning checklist"
          : "Complete job";
  async function enableAlerts() {
    try {
      const Audio = window.AudioContext || (window as any).webkitAudioContext;
      if (Audio) {
        audio.current ??= new Audio();
        await audio.current?.resume();
      }
      setAlerts(true);
      navigator.vibrate?.(50);
    } catch {
      setPushState("Sound is unavailable on this device.");
    }
  }
  async function enablePush() {
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window))
        throw new Error(
          "Push is unavailable. On iOS, install this app to the Home Screen first.",
        );
      const config = await fetch("/api/operations/push").then((r) => r.json());
      if (!config.publicKey)
        throw new Error(
          "Background push needs server VAPID configuration. In-app alerts are available.",
        );
      const registration = await navigator.serviceWorker.register(
        "/ops-sw.js",
        { scope: "/" },
      );
      await navigator.serviceWorker.ready;
      const permission = await Notification.requestPermission();
      if (permission !== "granted")
        throw new Error("Notifications are not enabled in this browser.");
      const padding = "=".repeat((4 - (config.publicKey.length % 4)) % 4),
        raw = atob(
          (config.publicKey + padding).replace(/-/g, "+").replace(/_/g, "/"),
        ),
        key = Uint8Array.from(raw, (c) => c.charCodeAt(0));
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key,
      });
      const response = await fetch("/api/operations/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription),
      });
      if (!response.ok)
        throw new Error("Could not save this device subscription.");
      setPushState("Background notifications enabled on this device.");
    } catch (e) {
      setPushState((e as Error).message);
    }
  }
  return (
    <section className="platform-card ops-job-board">
      <div className="ops-section-heading">
        <div>
          <h2>{compact ? "Priority work queue" : "Operations dispatcher"}</h2>
          <p>
            {filtered.length} visible jobs · critical and overdue work first
          </p>
        </div>
        <div className="platform-actions">
          {canAttend && !compact && (
            <details className="ops-alert-preferences">
              <summary>Alert settings</summary>
              <div>
                <button
                  className="button button-ghost"
                  disabled={alerts}
                  onClick={enableAlerts}
                >
                  {alerts ? "Sound enabled" : "Enable sound"}
                </button>
                <button className="button button-ghost" onClick={enablePush}>
                  Enable push
                </button>
                <button
                  className="button button-ghost"
                  onClick={async () => {
                    try {
                      const response = await fetch("/api/operations/push", {
                        method: "DELETE",
                      });
                      if (!response.ok)
                        throw new Error("Could not disable push.");
                      const registration =
                        await navigator.serviceWorker?.getRegistration();
                      const subscription =
                        await registration?.pushManager.getSubscription();
                      await subscription?.unsubscribe();
                      setPushState(
                        "Background notifications disabled for your account.",
                      );
                    } catch (e) {
                      setPushState((e as Error).message);
                    }
                  }}
                >
                  Disable push
                </button>
              </div>
            </details>
          )}
          {canAttend && (
            <button className="button button-dark" onClick={onCreate}>
              New service job
            </button>
          )}
        </div>
      </div>
      {pushState && <p role="status">{pushState}</p>}
      <div className="ops-board-filters">
        <label>
          Department
          <select value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="all">All departments</option>
            {[
              ...new Set([
                ...departments,
                ...data.jobs.map((j) => j.department),
              ]),
            ]
              .filter((d) => d !== "*")
              .map((d) => (
                <option key={d}>{d}</option>
              ))}
          </select>
        </label>
        <label>
          Queue
          <select value={view} onChange={(e) => setView(e.target.value)}>
            <option value="all">All active work</option>
            <option value="mine">Assigned to me</option>
            <option value="overdue">Overdue</option>
            <option value="unassigned">Unassigned</option>
            <option value="history">Recent closed jobs</option>
          </select>
        </label>
        <label className="ops-search">
          Find a job
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Title, room or department"
          />
        </label>
      </div>
      {!filtered.length ? (
        <Empty>No jobs match this queue.</Empty>
      ) : (
        <div className="ops-task-list">
          {filtered.slice(0, compact ? 8 : 100).map((j) => (
            <article
              key={j.id}
              className={`ops-task ${["open", "in_progress"].includes(j.status) && (j.priority === "critical" || Date.parse(j.due_at) < now) ? "ops-task-critical" : ""}`}
            >
              <div className="ops-task-content">
                <div className="ops-task-meta">
                  <span>
                    {j.department === "*" ? "General operations" : j.department}
                  </span>
                  <span>
                    Room <RoomLabel roomId={j.room_id} rooms={data.rooms} />
                    {j.location && ` · ${j.location}`}
                  </span>
                </div>
                <h3>{j.title}</h3>
                {j.description && <p>{j.description}</p>}
                {j.guest_name && <p>Guest: {j.guest_name}</p>}
                {j.resolution_notes && <p>Resolution: {j.resolution_notes}</p>}
                <div className="ops-task-status">
                  <Status value={j.status} />
                  <Status value={j.priority} />
                  {j.acknowledged_at && <span>Acknowledged</span>}
                  {!!j.escalation_level && (
                    <span>Escalation level {j.escalation_level}</span>
                  )}
                </div>
              </div>
              <div className="ops-task-dispatch">
                <time
                  className={
                    ["open", "in_progress"].includes(j.status) &&
                    Date.parse(j.due_at) < now
                      ? "ops-overdue"
                      : ""
                  }
                  dateTime={j.due_at}
                >
                  {["completed", "cancelled"].includes(j.status)
                    ? `${j.status === "completed" ? "Completed" : "Cancelled"} · ${new Date(j.completed_at || j.updated_at || j.created_at).toLocaleString()}`
                    : deadlineLabel(j.due_at, now)}
                </time>
                {user.isOrganizationAdmin ? (
                  <label>
                    Assigned to
                    <select
                      aria-label={`Assign ${j.title}`}
                      value={j.assigned_to || ""}
                      disabled={busy}
                      onChange={(e) =>
                        mutate(
                          "job",
                          { id: j.id, assigned_to: e.target.value || null },
                          true,
                        )
                      }
                    >
                      <option value="">Unassigned</option>
                      {data.team
                        .filter(
                          (p) =>
                            p.isAdmin ||
                            p.id === j.assigned_to ||
                            p.property_id === j.property_id ||
                            p.property_ids?.includes(j.property_id),
                        )
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.full_name}
                          </option>
                        ))}
                    </select>
                  </label>
                ) : (
                  <span>{j.assignee?.full_name || "Unassigned"}</span>
                )}
                {attend(j) && ["open", "in_progress"].includes(j.status) && (
                  <>
                    <button
                      type="button"
                      className="button button-outline ops-desktop-action"
                      disabled={busy}
                      onClick={() => act(j)}
                    >
                      {actionLabel(j)}
                    </button>
                    <div className="ops-mobile-action">
                      <SlideAction
                        label={actionLabel(j)}
                        disabled={busy}
                        onComplete={() => act(j)}
                      />
                    </div>
                  </>
                )}
                {user.isOrganizationAdmin &&
                  ["open", "in_progress"].includes(j.status) && (
                    <button
                      className="button button-ghost"
                      disabled={busy}
                      onClick={() => setCancel(j)}
                    >
                      Cancel job
                    </button>
                  )}
              </div>
            </article>
          ))}
        </div>
      )}
      {filtered.length > (compact ? 8 : 100) && (
        <p>
          {compact
            ? "Open Service jobs to see the full queue."
            : "Showing the first 100 matches. Narrow the filters to locate more work."}
        </p>
      )}
      {cancel && (
        <Dialog
          title="Cancel service job"
          busy={busy}
          onClose={() => setCancel(null)}
        >
          <p>
            Cancel “{cancel.title}”? The record remains in job history. Create a
            follow-up job if the work is needed later.
          </p>
          {error && <p role="alert">{error}</p>}
          <div className="ops-form-actions">
            <button
              className="button button-ghost"
              disabled={busy}
              onClick={() => setCancel(null)}
            >
              Keep job
            </button>
            <button
              className="button button-dark"
              disabled={busy}
              onClick={async () => {
                if (
                  await mutate(
                    "job",
                    { id: cancel.id, status: "cancelled" },
                    true,
                  )
                )
                  setCancel(null);
              }}
            >
              Cancel job
            </button>
          </div>
        </Dialog>
      )}
      {urgent && (
        <Dialog
          title="New urgent job received"
          busy={busy}
          onClose={() => setUrgent(null)}
        >
          <div className="ops-urgent-banner">
            <BellRing size={20} />
            <div>
              <h3>{urgent.title}</h3>
              <p>
                {urgent.department} · Room{" "}
                <RoomLabel roomId={urgent.room_id} rooms={data.rooms} />
              </p>
              <p>{deadlineLabel(urgent.due_at, now)}</p>
            </div>
          </div>
          <p>{urgent.description}</p>
          {error && <p role="alert">{error}</p>}
          <div className="ops-form-actions">
            <button
              className="button button-ghost"
              disabled={busy}
              onClick={() => setUrgent(null)}
            >
              Review in queue
            </button>
            <button
              className="button button-dark"
              disabled={busy || !attend(urgent)}
              onClick={async () => {
                if (
                  await mutate(
                    "job",
                    { id: urgent.id, acknowledge: true },
                    true,
                  )
                )
                  setUrgent(null);
              }}
            >
              Acknowledge
            </button>
          </div>
        </Dialog>
      )}
    </section>
  );
}
