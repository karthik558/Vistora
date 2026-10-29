"use client";
import { useEffect, useRef, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import QRCode from "qrcode";
import { WorkspaceUser } from "./Dashboard";
import { useOperations } from "../lib/omniops/useOperations";
import { departments, Job, OperationTab, OpsRow } from "../lib/omniops/types";
import {
  canManageServiceJobs,
  canOperateDepartment,
} from "../lib/operations/access";
import { money } from "../lib/hospitality/config";
import {
  Dialog,
  Empty,
  Field,
  FormSpec,
  RecordForm,
  RoomLabel,
  Status,
} from "./OperationsUI";
import OperationsCharts from "./OperationsCharts";
import OperationsJobBoard from "./OperationsJobBoard";
import { CleaningChecklist, InspectionWorkflow } from "./OperationsWorkflows";

type Props = {
  user: WorkspaceUser;
  property: string;
  view: OperationTab | "Recovery";
};
export default function OperationsSuite(props: Props) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { refetchOnWindowFocus: true, retry: 1 },
          mutations: { retry: false },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <Suite {...props} />
    </QueryClientProvider>
  );
}
const option = (rows: OpsRow[], label: (row: OpsRow) => string) =>
  rows.map((row) => ({ value: row.id, label: label(row) }));
function Suite({ user, property, view }: Props) {
  const ops = useOperations(
      property,
      user.organizationId || user.id || "session",
    ),
    { data, mutate, busy } = ops;
  const [form, setForm] = useState<FormSpec | null>(null),
    [cleaning, setCleaning] = useState<Job | null>(null),
    [qr, setQr] = useState<{ title: string; value: string } | null>(null),
    [roomView, setRoomView] = useState("grid"),
    [roomStatus, setRoomStatus] = useState("all"),
    [roomSearch, setRoomSearch] = useState("");
  const [toast, setToast] = useState("");
  const [scan, setScan] = useState({ asset: "", luggage: "" });
  const canManage = !!user.isOrganizationAdmin,
    write = canManageServiceJobs(user),
    pid = property !== "all" ? property : "";
  useEffect(() => {
    setForm(null);
    setCleaning(null);
    setQr(null);
    setToast("");
    const params = new URLSearchParams(window.location.search);
    setScan({
      asset: params.get("asset") || "",
      luggage: params.get("luggage") || "",
    });
  }, [property, view]);
  if (ops.isPending)
    return (
      <section className="platform-card" aria-busy="true">
        <p role="status">Loading operations…</p>
      </section>
    );
  if (ops.error && !data)
    return (
      <section className="platform-card">
        <h2>Operations are unavailable</h2>
        <p role="alert">{ops.error.message}</p>
        <button className="button button-outline" onClick={() => ops.refetch()}>
          Retry
        </button>
        <p>
          Existing guest, room, complaint and cost workflows remain available
          from the menu.
        </p>
      </section>
    );
  if (!data) return null;
  const scoped = (rows: OpsRow[]) =>
    rows.filter((row) => !pid || row.property_id === pid);
  const activeStays = scoped(data.stays).filter((s) => s.status === "active"),
    rooms = scoped(data.rooms),
    assets = scoped(data.assets).filter(
      (a) => view !== "Maintenance" || !scan.asset || a.id === scan.asset,
    ),
    jobs = data.jobs.filter((j) => ["open", "in_progress"].includes(j.status));
  const stayOptions = option(
      activeStays,
      (s) =>
        `Room ${s.room_number} · ${s.guest_count} guest${s.guest_count === 1 ? "" : "s"}`,
    ),
    roomOptions = option(
      rooms,
      (r) => `Room ${r.room_number} · ${r.status.replaceAll("_", " ")}`,
    );
  const clearScan = () => {
    setScan({ asset: "", luggage: "" });
    const params = new URLSearchParams(window.location.search);
    params.delete("asset");
    params.delete("luggage");
    window.history.replaceState(null, "", "/dashboard/hospitality?" + params);
  };
  const create = (spec: FormSpec) => {
    ops.setNotice("");
    setToast("");
    setForm(spec);
  };
  const field = (
    name: string,
    label: string,
    type: Field["type"] = "text",
    extra: Partial<Field> = {},
  ): Field => ({ name, label, type, ...extra });
  const stayField = field("stay_id", "Guest stay", "select", {
    options: stayOptions,
  });
  const newJob = () =>
    create({
      title: "New service job",
      action: "job_create",
      description:
        "Choose a room or enter a public area. Routing rules assign the department owner when no staff member is selected.",
      fields: [
        field("title", "Request title"),
        field("department", "Department", "select", {
          options: departments
            .filter((d) => canOperateDepartment(user, d))
            .map((d) => ({ value: d, label: d })),
        }),
        field("kind", "Work type", "select", {
          options: [
            { value: "guest_request", label: "Guest request" },
            { value: "cleaning", label: "Room cleaning" },
            { value: "maintenance", label: "Maintenance" },
            { value: "inspection", label: "Inspection" },
          ],
          value: "guest_request",
        }),
        field("priority", "Priority", "select", {
          value: "normal",
          options: [
            { value: "low", label: "Low" },
            { value: "normal", label: "Standard" },
            { value: "high", label: "Urgent" },
            { value: "critical", label: "Critical" },
          ],
        }),
        field("room_id", "Room", "select", {
          required: false,
          options: roomOptions,
        }),
        field("location", "Public area / location", "text", {
          required: false,
        }),
        field("guest_name", "Guest name", "text", { required: false }),
        ...(data.feedback?.length
          ? [
              field("feedback_id", "Open feedback case", "select", {
                required: false,
                options: option(
                  data.feedback.filter((f) => f.property_id === pid),
                  (f) =>
                    `${f.department} · Room ${f.room_number || "—"} · ${f.rating}/5`,
                ),
              }),
            ]
          : []),
        field("asset_id", "Asset", "select", {
          required: false,
          options: option(
            assets.filter((a) => a.status === "active"),
            (a) => a.name,
          ),
        }),
        field("assigned_to", "Assigned staff", "select", {
          required: false,
          options: option(
            data.team.filter(
              (p) =>
                p.isAdmin ||
                p.property_id === pid ||
                p.property_ids?.includes(pid),
            ),
            (p) => p.full_name,
          ),
        }),
        field("due_at", "Due at · optional", "datetime-local", {
          required: false,
          hint: "Leave blank to use the workspace response target. Overrides use device local time and must be within seven days.",
        }),
        field("description", "Details", "textarea", { required: false }),
      ],
    });
  const onCreate = () =>
    pid
      ? newJob()
      : ops.setNotice(
          "Choose one property in the page filter before creating work.",
        );
  const openCleaning = (job: Job) => {
    if (!job.acknowledged_at || job.status !== "in_progress") {
      ops.setNotice(
        "Acknowledge and start the cleaning job in Service jobs before completing its checklist.",
      );
      return;
    }
    setCleaning(job);
  };
  const confirmation = (row: OpsRow, kind: "luggage" | "valet", next: string) =>
    create({
      title:
        next === "delivered"
          ? "Verify luggage delivery"
          : "Verify vehicle handover",
      action: kind + "_status",
      defaults: { id: row.id, status: next, property_id: row.property_id },
      fields: [field("verification", "Recipient / verification reference")],
      submit: "Confirm handover",
    });
  const resolveJob = (job: Job) =>
    create({
      title: "Complete service job",
      action: "job_resolve",
      defaults: { job_id: job.id, property_id: job.property_id },
      description: job.title,
      fields: [field("resolution_notes", "Resolution notes", "textarea")],
      submit: "Complete job",
    });
  const change = (action: string, row: OpsRow, status: string) =>
    mutate(action, { id: row.id, property_id: row.property_id, status });
  const occupancy = (room: OpsRow) =>
    data.stays.some((s) => s.room_id === room.id && s.status === "active")
      ? "occupied"
      : "vacant";
  const visibleRooms = rooms
    .filter(
      (r) =>
        (roomStatus === "all" ||
          r.status === roomStatus ||
          occupancy(r) === roomStatus) &&
        [r.room_number, r.floor, r.room_type]
          .join(" ")
          .toLowerCase()
          .includes(roomSearch.toLowerCase()),
    )
    .sort((a, b) => {
      const arrival = (r: OpsRow) =>
        Math.min(
          ...data.stays
            .filter((s) => s.room_id === r.id && s.status === "reserved")
            .map((s) => Date.parse(s.check_in_date)),
          Infinity,
        );
      return (
        arrival(a) - arrival(b) ||
        Number(b.status === "dirty") - Number(a.status === "dirty") ||
        a.room_number.localeCompare(b.room_number, undefined, { numeric: true })
      );
    });
  const overdue = jobs.filter((j) => Date.parse(j.due_at) < Date.now()),
    urgent = jobs.filter(
      (j) => j.priority === "critical" || j.priority === "high",
    );
  return (
    <div className="ops-suite">
      <div className="ops-connection">
        <span className={ops.connection === "Live" ? "ops-live" : ""}>
          {ops.connection}
        </span>
        <span>
          Updated{" "}
          {ops.dataUpdatedAt
            ? new Date(ops.dataUpdatedAt).toLocaleTimeString()
            : "—"}
        </span>
        <button
          type="button"
          className="button button-ghost compact"
          disabled={ops.isFetching || busy}
          onClick={() => ops.refresh()}
        >
          {ops.isFetching ? "Syncing…" : "Refresh"}
        </button>
      </div>
      {(ops.notice || ops.error) && (
        <p role="alert" className="platform-notice">
          {ops.notice || ops.error?.message}
        </p>
      )}
      {toast && (
        <p role="status" className="hotel-success">
          {toast}
        </p>
      )}
      {data.truncated && (
        <p role="status" className="platform-notice">
          This view has reached its record limit. Select one property to narrow
          the results. Charts aggregate all authorized jobs.
        </p>
      )}
      {property === "all" && view !== "Overview" && view !== "Service jobs" && (
        <p className="platform-notice">
          Viewing all properties. Select one property above to add records or
          run a workflow.
        </p>
      )}
      {view === "Overview" && (
        <>
          <section className="platform-stats" aria-label="Operations summary">
            {[
              ["Active service jobs", data.summary?.activeJobs ?? jobs.length],
              ["Overdue", data.summary?.overdue ?? overdue.length],
              [
                "Ready rooms",
                data.summary?.readyRooms ??
                  rooms.filter(
                    (r) =>
                      ["clean", "inspected"].includes(r.status) &&
                      occupancy(r) === "vacant",
                  ).length,
              ],
              ["In-house stays", data.summary?.inHouse ?? activeStays.length],
            ].map(([label, value]) => (
              <article className="platform-stat" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </article>
            ))}
          </section>
          <OperationsCharts rows={data.trend} />
          <section className="platform-card">
            <div className="ops-section-heading">
              <div>
                <h2>SLA escalation radar</h2>
                <p>
                  {overdue.length} overdue · {urgent.length} urgent or critical
                  · {jobs.filter((j) => !j.assigned_to).length} unassigned
                </p>
              </div>
              {canManage && (
                <a
                  className="button button-outline"
                  href={`/dashboard/role-mapping?workspace=operations`}
                >
                  Routing rules
                </a>
              )}
            </div>
            {!overdue.length && !urgent.length ? (
              <Empty>No urgent or overdue service jobs.</Empty>
            ) : (
              <div className="ops-radar">
                {[
                  ...new Map(
                    [...overdue, ...urgent].map((j) => [j.id, j]),
                  ).values(),
                ]
                  .slice(0, 8)
                  .map((j) => (
                    <div className="ops-radar-row" key={j.id}>
                      <div>
                        <strong>{j.title}</strong>
                        <small>
                          {j.department} · Room{" "}
                          <RoomLabel roomId={j.room_id} rooms={data.rooms} />
                        </small>
                      </div>
                      <Status
                        value={
                          Date.parse(j.due_at) < Date.now()
                            ? "overdue"
                            : j.priority
                        }
                      />
                      <span>
                        {j.escalation_level
                          ? `Level ${j.escalation_level}`
                          : j.acknowledged_at
                            ? "Acknowledged"
                            : "Awaiting response"}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </section>
          <OperationsJobBoard
            data={data}
            user={user}
            mutate={mutate}
            busy={busy}
            onCreate={onCreate}
            onClean={openCleaning}
            onResolve={resolveJob}
            error={ops.notice}
            compact
          />
          <section className="platform-card">
            <h2>Recent operational activity</h2>
            {!data.audit.length ? (
              <Empty>No operational changes recorded.</Empty>
            ) : (
              <div className="ops-audit">
                {data.audit.slice(0, 15).map((a) => (
                  <div key={a.id}>
                    <span>
                      {a.entity_type.replaceAll("_", " ")} · {a.action}
                      {a.details?.status && ` · ${a.details.status}`}
                    </span>
                    <time>{new Date(a.created_at).toLocaleString()}</time>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
      {view === "Service jobs" && (
        <OperationsJobBoard
          data={data}
          user={user}
          mutate={mutate}
          busy={busy}
          onCreate={onCreate}
          onClean={openCleaning}
          onResolve={resolveJob}
          error={ops.notice}
        />
      )}
      {view === "Cleaning" && (
        <>
          <section className="platform-card">
            <div className="ops-section-heading">
              <div>
                <h2>Room cleaning queue</h2>
                <p>
                  Upcoming arrivals first. Occupancy and cleanliness are tracked
                  separately.
                </p>
              </div>
              <div className="ops-choice" aria-label="Room view">
                {["grid", "list"].map((v) => (
                  <button
                    key={v}
                    aria-pressed={roomView === v}
                    onClick={() => setRoomView(v)}
                  >
                    {v === "grid" ? "Grid" : "List"}
                  </button>
                ))}
              </div>
            </div>
            <div className="ops-board-filters">
              <label>
                Room state
                <select
                  value={roomStatus}
                  onChange={(e) => setRoomStatus(e.target.value)}
                >
                  {[
                    "all",
                    "dirty",
                    "clean",
                    "inspected",
                    "out_of_service",
                    "occupied",
                    "vacant",
                  ].map((s) => (
                    <option value={s} key={s}>
                      {s === "all" ? "All rooms" : s.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Find a room
                <input
                  value={roomSearch}
                  onChange={(e) => setRoomSearch(e.target.value)}
                  placeholder="Room, floor or type"
                />
              </label>
            </div>
            {!visibleRooms.length ? (
              <Empty>No rooms match these filters.</Empty>
            ) : (
              <div className={`ops-room-${roomView}`}>
                {visibleRooms.map((r) => {
                  const job = jobs.find(
                      (j) => j.room_id === r.id && j.kind === "cleaning",
                    ),
                    arrival = data.stays.find(
                      (s) => s.room_id === r.id && s.status === "reserved",
                    );
                  return (
                    <article className="ops-room" key={r.id}>
                      <div>
                        <h3>Room {r.room_number}</h3>
                        <small>
                          {r.room_type} · Floor {r.floor || "—"}
                        </small>
                      </div>
                      <div className="ops-room-states">
                        <Status value={r.status} />
                        <Status value={occupancy(r)} />
                      </div>
                      <p>
                        {arrival
                          ? `Next arrival ${arrival.check_in_date}`
                          : "No upcoming arrival"}
                      </p>
                      {job ? (
                        <div>
                          <small>
                            {job.assignee?.full_name || "Awaiting assignment"}
                          </small>
                          {(canManage ||
                            (job.assigned_to === user.id && write)) && (
                            <button
                              className="button button-outline"
                              disabled={busy}
                              onClick={() => openCleaning(job)}
                            >
                              Cleaning checklist
                            </button>
                          )}
                        </div>
                      ) : canManage && pid && r.status === "dirty" ? (
                        <button
                          className="button button-outline"
                          onClick={() =>
                            create({
                              title: `Clean room ${r.room_number}`,
                              action: "job_create",
                              defaults: {
                                room_id: r.id,
                                department: "Housekeeping",
                                kind: "cleaning",
                                priority: arrival ? "high" : "normal",
                                title: `Clean room ${r.room_number}`,
                                due_at: new Date(
                                  Date.now() + 3600000,
                                ).toISOString(),
                              },
                              fields: [
                                field(
                                  "description",
                                  "Cleaning instructions",
                                  "textarea",
                                  { required: false },
                                ),
                              ],
                            })
                          }
                        >
                          Queue cleaning
                        </button>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
          {canManage && (
            <section className="platform-card">
              <div className="ops-section-heading">
                <div>
                  <h2>Minibar catalog</h2>
                  <p>
                    Prices are in minor currency units; consumption uses these
                    prices and requires folio approval.
                  </p>
                </div>
                <button
                  className="button button-outline"
                  disabled={!pid}
                  onClick={() =>
                    create({
                      title: "Add minibar item",
                      action: "catalog",
                      fields: [
                        field("name", "Item name"),
                        field(
                          "price_minor",
                          `Unit price in minor units · ${data.currency}`,
                          "number",
                          { min: 0, max: 10000000 },
                        ),
                        field("par_level", "Restock par level", "number", {
                          min: 1,
                          max: 100,
                          value: 2,
                        }),
                      ],
                    })
                  }
                >
                  Add item
                </button>
              </div>
              {!data.catalog.length ? (
                <Empty>No minibar items configured.</Empty>
              ) : (
                <div className="ops-simple-list">
                  {data.catalog.map((i) => (
                    <div key={i.id}>
                      <strong>{i.name}</strong>
                      <span>
                        {money(i.price_minor, i.currency)} · par {i.par_level}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}
      {view === "Maintenance" && (
        <>
          {scan.asset && (
            <p className="platform-notice">
              Showing the scanned asset.{" "}
              <button className="button button-ghost" onClick={clearScan}>
                Show all assets
              </button>
            </p>
          )}
          <section className="platform-card">
            <div className="ops-section-heading">
              <div>
                <h2>Asset registry</h2>
                <p>
                  QR tags identify the asset; create reactive repairs through
                  Service jobs.
                </p>
              </div>
              {canManage && (
                <button
                  className="button button-dark"
                  disabled={!pid}
                  onClick={() =>
                    create({
                      title: "Register asset",
                      action: "asset",
                      fields: [
                        field("name", "Asset name"),
                        field("category", "Category", "select", {
                          options: [
                            "HVAC",
                            "Boiler",
                            "Elevator",
                            "Electrical",
                            "Plumbing",
                            "Other",
                          ].map((s) => ({ value: s, label: s })),
                        }),
                        field("location", "Location"),
                        field("room_id", "Room", "select", {
                          required: false,
                          options: roomOptions,
                        }),
                        field("serial_number", "Serial number", "text", {
                          required: false,
                        }),
                      ],
                    })
                  }
                >
                  Register asset
                </button>
              )}
            </div>
            {!assets.length ? (
              <Empty>No assets registered.</Empty>
            ) : (
              <div className="ops-simple-list">
                {assets.map((a) => (
                  <div key={a.id}>
                    <div>
                      <strong>{a.name}</strong>
                      <small>
                        {a.category} · {a.location} ·{" "}
                        {a.serial_number || "No serial number"}
                      </small>
                    </div>
                    <Status value={a.status} />
                    <button
                      className="button button-ghost"
                      onClick={() =>
                        setQr({
                          title: a.name,
                          value:
                            window.location.origin +
                            `/dashboard/hospitality?section=Maintenance&property=${a.property_id}&asset=${a.id}`,
                        })
                      }
                    >
                      Asset QR
                    </button>
                    {canManage && pid && (
                      <button
                        className="button button-outline"
                        onClick={() =>
                          create({
                            title: `Repair ${a.name}`,
                            action: "job_create",
                            defaults: {
                              asset_id: a.id,
                              room_id: a.room_id,
                              location: a.location,
                              kind: "maintenance",
                              department: "Engineering",
                              priority: "high",
                              title: `Repair ${a.name}`,
                              due_at: new Date(
                                Date.now() + 3600000,
                              ).toISOString(),
                            },
                            fields: [
                              field("description", "Fault details", "textarea"),
                            ],
                          })
                        }
                      >
                        Report fault
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
          <section className="platform-card">
            <div className="ops-section-heading">
              <div>
                <h2>Preventive maintenance calendar</h2>
                <p>
                  Recurring schedules create one work order per due occurrence
                  when the scheduler runs.
                </p>
              </div>
              {canManage && (
                <button
                  className="button button-outline"
                  disabled={!pid || !assets.length}
                  onClick={() =>
                    create({
                      title: "Schedule preventive maintenance",
                      action: "maintenance",
                      fields: [
                        field("asset_id", "Asset", "select", {
                          options: option(assets, (a) => a.name),
                        }),
                        field("title", "Work order title"),
                        field(
                          "interval_days",
                          "Repeat every (days)",
                          "number",
                          { min: 1, max: 366, value: 30 },
                        ),
                        field("next_due_at", "First due", "datetime-local"),
                        field("assigned_to", "Assigned engineer", "select", {
                          required: false,
                          options: option(data.team, (p) => p.full_name),
                        }),
                      ],
                    })
                  }
                >
                  Add schedule
                </button>
              )}
            </div>
            {!data.maintenance.length ? (
              <Empty>No preventive schedules configured.</Empty>
            ) : (
              <div className="ops-simple-list">
                {[...data.maintenance]
                  .sort(
                    (a, b) =>
                      Date.parse(a.next_due_at) - Date.parse(b.next_due_at),
                  )
                  .map((m) => (
                    <div key={m.id}>
                      <div>
                        <strong>{m.title}</strong>
                        <small>
                          {assets.find((a) => a.id === m.asset_id)?.name} ·
                          every {m.interval_days} days
                        </small>
                      </div>
                      <time>{new Date(m.next_due_at).toLocaleString()}</time>
                      <Status value={m.is_active ? "active" : "paused"} />
                      {canManage && (
                        <button
                          className="button button-ghost"
                          disabled={busy}
                          onClick={() =>
                            mutate("maintenance_toggle", {
                              id: m.id,
                              property_id: m.property_id,
                              is_active: !m.is_active,
                            })
                          }
                        >
                          {m.is_active ? "Pause" : "Resume"}
                        </button>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </section>
        </>
      )}
      {view === "Concierge" && (
        <>
          {scan.luggage && (
            <p className="platform-notice">
              Showing the scanned luggage tag.{" "}
              <button className="button button-ghost" onClick={clearScan}>
                Show all luggage
              </button>
            </p>
          )}
          <section className="platform-card">
            <div className="ops-section-heading">
              <div>
                <h2>Luggage tracking</h2>
                <p>
                  Tag bags, record storage location, and verify the recipient at
                  delivery.
                </p>
              </div>
              {canOperateDepartment(user, "Concierge") && (
                <button
                  className="button button-dark"
                  disabled={!pid || !activeStays.length}
                  onClick={() =>
                    create({
                      title: "Register luggage",
                      action: "luggage",
                      fields: [
                        stayField,
                        field("pieces", "Pieces", "number", {
                          min: 1,
                          max: 50,
                          value: 1,
                        }),
                        field("storage_location", "Storage location"),
                      ],
                    })
                  }
                >
                  Register luggage
                </button>
              )}
            </div>
            {!data.luggage.length ? (
              <Empty>No luggage records.</Empty>
            ) : (
              <div className="ops-simple-list">
                {data.luggage
                  .filter((l) => !scan.luggage || l.id === scan.luggage)
                  .map((l) => (
                    <div key={l.id}>
                      <div>
                        <strong>
                          {l.pieces} bag{l.pieces === 1 ? "" : "s"} · Room{" "}
                          {data.stays.find((s) => s.id === l.stay_id)
                            ?.room_number || "—"}
                        </strong>
                        <small>
                          {l.storage_location} · tag {l.id.slice(0, 8)}
                          {l.verification && ` · ${l.verification}`}
                        </small>
                      </div>
                      <Status value={l.status} />
                      <button
                        className="button button-ghost"
                        onClick={() =>
                          setQr({
                            title: `Luggage tag · ${l.id.slice(0, 8)}`,
                            value:
                              window.location.origin +
                              `/dashboard/hospitality?section=Concierge&property=${l.property_id}&luggage=${l.id}`,
                          })
                        }
                      >
                        Luggage QR
                      </button>
                      {canOperateDepartment(user, "Concierge") &&
                        l.status !== "delivered" && (
                          <button
                            className="button button-outline"
                            disabled={busy}
                            onClick={() => {
                              const next =
                                l.status === "stored"
                                  ? "requested"
                                  : l.status === "requested"
                                    ? "in_transit"
                                    : "delivered";
                              next === "delivered"
                                ? confirmation(l, "luggage", next)
                                : change("luggage_status", l, next);
                            }}
                          >
                            {l.status === "stored"
                              ? "Request delivery"
                              : l.status === "requested"
                                ? "Start delivery"
                                : "Verify delivery"}
                          </button>
                        )}
                    </div>
                  ))}
              </div>
            )}
          </section>
          <section className="platform-card">
            <div className="ops-section-heading">
              <div>
                <h2>Valet dispatch</h2>
                <p>
                  Vehicle tickets stay linked to the guest stay and parking bay.
                </p>
              </div>
              {canOperateDepartment(user, "Valet & Transfers") && (
                <button
                  className="button button-outline"
                  disabled={!pid || !activeStays.length}
                  onClick={() =>
                    create({
                      title: "Register vehicle",
                      action: "valet",
                      fields: [
                        stayField,
                        field("registration", "Vehicle registration"),
                        field("parking_bay", "Parking bay"),
                      ],
                    })
                  }
                >
                  Register vehicle
                </button>
              )}
            </div>
            {!data.valet.length ? (
              <Empty>No valet tickets.</Empty>
            ) : (
              <div className="ops-simple-list">
                {data.valet.map((v) => (
                  <div key={v.id}>
                    <div>
                      <strong>{v.registration}</strong>
                      <small>
                        Bay {v.parking_bay} · ticket {v.id.slice(0, 8)}
                      </small>
                    </div>
                    <Status value={v.status} />
                    {canOperateDepartment(user, "Valet & Transfers") &&
                      v.status !== "returned" && (
                        <button
                          className="button button-outline"
                          disabled={busy}
                          onClick={() => {
                            const next =
                              v.status === "parked"
                                ? "requested"
                                : v.status === "requested"
                                  ? "retrieving"
                                  : "returned";
                            next === "returned"
                              ? confirmation(v, "valet", next)
                              : change("valet_status", v, next);
                          }}
                        >
                          {v.status === "parked"
                            ? "Retrieve vehicle"
                            : v.status === "requested"
                              ? "Start retrieval"
                              : "Verify handover"}
                        </button>
                      )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
      {view === "Breakfast" && (
        <section className="platform-card">
          <div className="ops-section-heading">
            <div>
              <h2>Breakfast attendance</h2>
              <p>
                Room lookup records today's attendance once per stay and queues
                a housekeeping opportunity.
              </p>
            </div>
            {(canOperateDepartment(user, "Front Desk") ||
              canOperateDepartment(user, "Food & Beverage")) && (
              <button
                className="button button-dark"
                disabled={!pid || !activeStays.length}
                onClick={() =>
                  create({
                    title: "Record breakfast attendance",
                    action: "breakfast",
                    fields: [
                      stayField,
                      field("guest_count", "Guests attending", "number", {
                        min: 1,
                        max: 20,
                        value: 1,
                      }),
                    ],
                    description:
                      "Verify the room or boarding pass with the guest. This does not change room occupancy or authorize entry.",
                  })
                }
              >
                Check in for breakfast
              </button>
            )}
          </div>
          <p className="platform-notice">
            Breakfast attendance does not guarantee an empty room. Housekeeping
            must confirm access and respect do-not-disturb.
          </p>
          {!data.breakfast.length ? (
            <Empty>No breakfast attendance recorded.</Empty>
          ) : (
            <div className="ops-simple-list">
              {data.breakfast.map((b) => (
                <div key={b.id}>
                  <div>
                    <strong>
                      Room{" "}
                      {data.stays.find((s) => s.id === b.stay_id)
                        ?.room_number || "—"}
                    </strong>
                    <small>
                      {b.guest_count} guests · {b.service_date}
                    </small>
                  </div>
                  <span>
                    {b.cleaning_job_id ? "Housekeeping notified" : "Recorded"}
                  </span>
                  <time>{new Date(b.created_at).toLocaleTimeString()}</time>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
      {view === "Breakfast" && canManage && (
        <section className="platform-card">
          <div className="ops-section-heading">
            <div>
              <h2>Housekeeping webhook</h2>
              <p>
                Optionally send breakfast cleaning opportunities to a configured
                hotel integration. Only explicitly enabled endpoints receive
                room attendance events.
              </p>
            </div>
            <button
              className="button button-outline"
              disabled={!pid || !data.webhookEndpoints?.length}
              onClick={() =>
                create({
                  title: "Enable housekeeping webhook",
                  action: "breakfast_webhook",
                  description:
                    "This endpoint will receive this property's room number and breakfast cleaning opportunity, with no guest contact details. Choose only an integration authorized to receive it.",
                  fields: [
                    field("endpoint_id", "Integration endpoint", "select", {
                      options: option(
                        data.webhookEndpoints || [],
                        (w) => w.url,
                      ),
                    }),
                  ],
                  submit: "Enable for this property",
                })
              }
            >
              Enable endpoint
            </button>
          </div>
          {!data.webhookEndpoints?.length && (
            <p>Add an endpoint in Workspace → Integrations first.</p>
          )}
          {(data.webhooks || []).map((w) => (
            <div className="platform-row" key={w.id}>
              <span>
                {data.webhookEndpoints?.find((e) => e.id === w.endpoint_id)
                  ?.url || "Configured endpoint"}
                <small>{w.is_active ? "Enabled" : "Disabled"}</small>
              </span>
              {w.is_active && (
                <button
                  className="button button-ghost"
                  disabled={busy}
                  onClick={() =>
                    mutate("breakfast_webhook", {
                      property_id: w.property_id,
                      endpoint_id: w.endpoint_id,
                      is_active: false,
                    })
                  }
                >
                  Disable
                </button>
              )}
            </div>
          ))}
        </section>
      )}
      {view === "Inspections" && (
        <InspectionWorkflow
          data={data}
          property={property}
          busy={busy}
          mutate={mutate}
          canManage={canManage}
          onNewTemplate={() =>
            create({
              title: "Build inspection checklist",
              action: "template",
              fields: [
                field("name", "Checklist name"),
                field("checks", "Inspection points", "textarea", {
                  hint: "One unique point per line. Up to 30 points. Each saved version remains available for historical records.",
                }),
              ],
            })
          }
        />
      )}
      {view === "Guest services" && (
        <>
          <section className="platform-card">
            <div className="ops-section-heading">
              <div>
                <h2>Contactless guest services</h2>
                <p>
                  Private, expiring stay links let guests request towels,
                  toiletries, room service, baggage pickup or valet retrieval.
                </p>
              </div>
              {canManage && (
                <button
                  className="button button-dark"
                  disabled={!pid || !activeStays.length}
                  onClick={() =>
                    create({
                      title: "Create guest service link",
                      action: "guest_link",
                      description:
                        "Creating a link revokes earlier service links for this stay. Share it only with the registered guest.",
                      fields: [stayField],
                      submit: "Generate private link",
                    })
                  }
                >
                  Create guest QR
                </button>
              )}
            </div>
            <p>
              Guest links expire at checkout and stop working as soon as the
              stay closes.
            </p>
          </section>
          <section className="platform-card">
            <div className="ops-section-heading">
              <div>
                <h2>Calls, wake-ups &amp; voicemail</h2>
                <p>
                  Wake-ups create front desk tasks. Call accounting is a
                  recording stub; no PBX connection is assumed.
                </p>
              </div>
              <div className="platform-actions">
                {canOperateDepartment(user, "Front Desk") && (
                  <>
                    <button
                      className="button button-outline"
                      disabled={!pid || !activeStays.length}
                      onClick={() =>
                        create({
                          title: "Schedule wake-up call",
                          action: "telephony",
                          defaults: { kind: "wake_up" },
                          fields: [
                            stayField,
                            field(
                              "scheduled_at",
                              "Wake-up time",
                              "datetime-local",
                            ),
                            field("notes", "Instructions", "textarea", {
                              required: false,
                            }),
                          ],
                        })
                      }
                    >
                      Schedule wake-up
                    </button>
                    <button
                      className="button button-ghost"
                      disabled={!pid || !activeStays.length}
                      onClick={() =>
                        create({
                          title: "Log outgoing call",
                          action: "telephony",
                          defaults: { kind: "call" },
                          description: `Configured rate: ${money(data.callRateMinor, data.currency)} per started minute. Charges, when configured, await approval.`,
                          fields: [
                            stayField,
                            field("destination", "Destination / extension"),
                            field(
                              "duration_seconds",
                              "Duration (seconds)",
                              "number",
                              { min: 1, max: 86400 },
                            ),
                          ],
                        })
                      }
                    >
                      Log call
                    </button>
                    <button
                      className="button button-ghost"
                      disabled={!pid || !activeStays.length}
                      onClick={() =>
                        create({
                          title: "Route guest voicemail",
                          action: "telephony",
                          defaults: { kind: "voicemail" },
                          fields: [
                            stayField,
                            field(
                              "notes",
                              "Message / callback details",
                              "textarea",
                            ),
                          ],
                        })
                      }
                    >
                      Route voicemail
                    </button>
                  </>
                )}
              </div>
            </div>
            {!data.telephony.length ? (
              <Empty>No telephony records.</Empty>
            ) : (
              <div className="ops-simple-list">
                {data.telephony.map((e) => (
                  <div key={e.id}>
                    <div>
                      <strong>
                        {e.kind.replaceAll("_", " ")} · Room{" "}
                        {data.stays.find((s) => s.id === e.stay_id)
                          ?.room_number || "—"}
                      </strong>
                      <small>
                        {e.scheduled_at
                          ? new Date(e.scheduled_at).toLocaleString()
                          : `${e.duration_seconds || 0} seconds`}
                        {e.notes && ` · ${e.notes}`}
                      </small>
                    </div>
                    <Status value={e.status} />
                    {canOperateDepartment(user, "Front Desk") &&
                      ["scheduled", "due"].includes(e.status) && (
                        <div className="platform-actions">
                          <button
                            className="button button-outline"
                            disabled={busy}
                            onClick={() =>
                              change("telephony_status", e, "completed")
                            }
                          >
                            Mark handled
                          </button>
                          {canManage && (
                            <button
                              className="button button-ghost"
                              disabled={busy}
                              onClick={() =>
                                change("telephony_status", e, "cancelled")
                              }
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
      {view === "Recovery" && canManage && (
        <>
          <section className="platform-card">
            <div className="ops-section-heading">
              <div>
                <h2>Guest compensation</h2>
                <p>
                  Incident credits require a reason and a separate manager
                  decision in the folio ledger.
                </p>
              </div>
              <button
                className="button button-outline"
                disabled={!pid || !activeStays.length}
                onClick={() =>
                  create({
                    title: "Request compensation",
                    action: "compensation",
                    fields: [
                      field("job_id", "Incident", "select", {
                        options: option(
                          data.jobs.filter((j) => !!j.issue_type),
                          (j) => j.title,
                        ),
                      }),
                      stayField,
                      field("kind", "Compensation type", "select", {
                        options: [
                          { value: "amenity_credit", label: "Amenity credit" },
                          { value: "room_discount", label: "Room discount" },
                        ],
                      }),
                      field(
                        "amount_minor",
                        `Credit in minor units · ${data.currency}`,
                        "number",
                        { min: 1, max: 10000000 },
                      ),
                      field("reason", "Reason / resolution", "textarea"),
                    ],
                  })
                }
              >
                Request compensation
              </button>
            </div>
            {!data.compensations.length ? (
              <Empty>No compensation requests.</Empty>
            ) : (
              <div className="ops-simple-list">
                {data.compensations.map((c) => (
                  <div key={c.id}>
                    <div>
                      <strong>{c.kind.replaceAll("_", " ")}</strong>
                      <small>{c.reason}</small>
                    </div>
                    <span>{money(c.amount_minor, data.currency)}</span>
                    <Status
                      value={
                        data.folios.find((f) => f.id === c.folio_entry_id)
                          ?.status || "pending"
                      }
                    />
                  </div>
                ))}
              </div>
            )}
          </section>
          <section className="platform-card">
            <h2>Guest folio approvals</h2>
            <p>
              Minibar consumption, call charges and recovery credits stay
              pending until approved. Mark posted only after the PMS confirms
              posting.
            </p>
            {!data.folios.length ? (
              <Empty>No folio entries.</Empty>
            ) : (
              <div className="ops-simple-list">
                {data.folios.map((f) => (
                  <div key={f.id}>
                    <div>
                      <strong>{f.description}</strong>
                      <small>
                        Stay {f.stay_id.slice(0, 8)}
                        {f.external_reference &&
                          ` · PMS ${f.external_reference}`}
                      </small>
                    </div>
                    <span>{money(f.amount_minor, f.currency)}</span>
                    <Status value={f.status} />
                    {f.status === "pending" && (
                      <div className="platform-actions">
                        <button
                          className="button button-outline"
                          disabled={busy}
                          onClick={() => change("folio_status", f, "approved")}
                        >
                          Approve
                        </button>
                        <button
                          className="button button-ghost"
                          disabled={busy}
                          onClick={() => change("folio_status", f, "rejected")}
                        >
                          Reject
                        </button>
                      </div>
                    )}
                    {f.status === "approved" && (
                      <button
                        className="button button-outline"
                        disabled={busy}
                        onClick={() =>
                          create({
                            title: "Record confirmed PMS posting",
                            action: "folio_status",
                            defaults: {
                              id: f.id,
                              status: "posted",
                              property_id: f.property_id,
                            },
                            description:
                              "This records an external posting reference. It does not charge the PMS automatically.",
                            fields: [
                              field(
                                "external_reference",
                                "PMS posting reference",
                              ),
                            ],
                          })
                        }
                      >
                        Record posting
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
      {form && (
        <RecordForm
          spec={form}
          property={pid}
          busy={busy}
          saveError={ops.notice}
          onClose={() => setForm(null)}
          onSave={async (action, fields) => {
            const result = await mutate(action, {
              ...fields,
              property_id: form.defaults?.property_id || pid,
            });
            if (result) {
              if (result.path)
                setQr({
                  title: "Private guest service link",
                  value: window.location.origin + result.path,
                });
              else setToast("Saved successfully.");
            }
            return result;
          }}
        />
      )}
      {cleaning && (
        <CleaningChecklist
          job={cleaning}
          data={data}
          busy={busy}
          mutate={mutate}
          saveError={ops.notice}
          onClose={() => setCleaning(null)}
        />
      )}
      {qr && (
        <QrDialog
          title={qr.title}
          value={qr.value}
          onClose={() => setQr(null)}
        />
      )}
    </div>
  );
}
function QrDialog({
  title,
  value,
  onClose,
}: {
  title: string;
  value: string;
  onClose: () => void;
}) {
  const [image, setImage] = useState(""),
    [error, setError] = useState(""),
    [copied, setCopied] = useState(false);
  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, { width: 300, margin: 2 })
      .then((url) => {
        if (active) setImage(url);
      })
      .catch(() => setError("QR code could not be generated."));
    return () => {
      active = false;
    };
  }, [value]);
  return (
    <Dialog title={title} onClose={onClose}>
      {image && <img className="ops-qr" src={image} alt={title + " QR code"} />}
      <p className="ops-break-url">{value}</p>
      {error && <p role="alert">{error}</p>}
      <div className="ops-form-actions">
        <button
          className="button button-outline"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
            } catch {
              setError("Copy is unavailable. Select and copy the link above.");
            }
          }}
        >
          {copied ? "Copied" : "Copy link"}
        </button>
        <a
          className="button button-dark"
          href={value}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open link
        </a>
      </div>
    </Dialog>
  );
}
