"use client";

import { useEffect, useState } from "react";
import { Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import WorkspaceSelect from "./WorkspaceSelect";
import WorkspaceDateField from "./WorkspaceDateField";

export default function CasePanel({ id, onUpdate }: { id: string; onUpdate?: () => void }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [deadline, setDeadline] = useState("");
  const [deadlineSuccess, setDeadlineSuccess] = useState(false);

  async function load() {
    const r = await fetch("/api/cases/" + id);
    const j = await r.json();
    if (!r.ok) throw new Error(j.error);
    setData(j);
    if (j?.record?.sla_deadline) {
      setDeadline(j.record.sla_deadline);
    }
  }

  useEffect(() => {
    setData(null);
    setError("");
    setDeadline("");
    setDeadlineSuccess(false);
    load().catch((e) => setError(e.message));
  }, [id]);

  async function perform(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await work();
      await load();
      onUpdate?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function send(url: string, body: any, method = "POST") {
    const r = await fetch(url, {
      method,
      headers: body instanceof FormData ? undefined : { "Content-Type": "application/json" },
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error);
    return j;
  }

  const existingDeadline = data?.record?.sla_deadline;
  const isOverdue =
    existingDeadline &&
    new Date(existingDeadline).getTime() < Date.now() &&
    data?.record?.status !== "resolved";

  return (
    <section className="case-panel">
      <div className="case-panel-header">
        <h3 style={{ margin: 0, fontSize: "13px", fontWeight: 650, color: "var(--ink)" }}>Case workspace</h3>
        {data?.record?.status === "resolved" ? (
          <span className="case-status-badge resolved">
            <CheckCircle2 size={12} /> Resolved
          </span>
        ) : isOverdue ? (
          <span className="case-status-badge overdue">
            <AlertTriangle size={12} /> SLA Overdue
          </span>
        ) : existingDeadline ? (
          <span className="case-status-badge active">
            <Clock size={12} /> Active SLA
          </span>
        ) : null}
      </div>

      {data && (
        <div className="case-attendance">
          <p>
            <strong>Owner:</strong> {data.record.assigned_to || "Unassigned"} ·{" "}
            <strong>Level:</strong>{" "}
            {data.record.routing_rule_id
              ? ["Junior", "Senior", "GM"][data.record.escalation_level || 0]
              : "Manual / unconfigured"}
            {data.record.escalation_due_at
              ? " · Next escalation: " + new Date(data.record.escalation_due_at).toLocaleString()
              : ""}
          </p>
          {!data.record.first_response_at && data.record.status !== "resolved" && (
            <button
              className="button button-dark"
              disabled={busy}
              onClick={() =>
                perform(async () => {
                  await send("/api/feedback/" + id, { acknowledge: true }, "PATCH");
                })
              }
              style={{ marginTop: "8px" }}
            >
              Acknowledge feedback
            </button>
          )}
        </div>
      )}

      {error && <p className="notice notice-error" role="alert">{error}</p>}

      {/* 2-Column Responsive Operational Metadata Grid */}
      <div className="case-fields-grid">
        <label className="case-field-label">
          <span>Priority</span>
          <WorkspaceSelect
            label="Case priority"
            floating={false}
            value={data?.record?.priority || ""}
            disabled={busy}
            placeholder="Choose priority"
            onChange={(priority) =>
              perform(async () => {
                await send("/api/feedback/" + id, { priority }, "PATCH");
              })
            }
            options={["low", "normal", "high", "critical"].map((v) => ({
              value: v,
              label: v.charAt(0).toUpperCase() + v.slice(1),
            }))}
          />
        </label>

        <label className="case-field-label">
          <span>Case owner</span>
          <WorkspaceSelect
            label="Case owner"
            floating={false}
            value={data?.record?.assigned_to || ""}
            disabled={busy || data?.canReassign === false}
            onChange={(assignedTo) =>
              perform(async () => {
                await send("/api/feedback/" + id, { assignedTo }, "PATCH");
              })
            }
            options={[
              { value: "", label: "Unassigned" },
              ...Array.from(
                new Set<string>([
                  ...(data?.team || []),
                  ...(data?.record?.assigned_to ? [data.record.assigned_to] : []),
                ])
              ).map((name) => ({ value: name, label: name })),
            ]}
          />
        </label>

        <label className="case-field-label">
          <span>Status</span>
          <WorkspaceSelect
            label="Case status"
            floating={false}
            value={data?.record?.status || ""}
            disabled={busy}
            placeholder="Choose status"
            onChange={(status) =>
              perform(async () => {
                await send("/api/feedback/" + id, { status }, "PATCH");
              })
            }
            options={["needs_attention", "under_review", "escalated", "resolved"].map((v) => ({
              value: v,
              label: v.replaceAll("_", " "),
            }))}
          />
        </label>

        <label className="case-field-label">
          <span>Category</span>
          <input
            placeholder={data?.record?.category || "e.g. cleanliness"}
            maxLength={60}
            defaultValue={data?.record?.category || ""}
            onBlur={(e) => {
              if (e.target.value !== (data?.record?.category || "")) {
                perform(async () => {
                  await send("/api/feedback/" + id, { category: e.target.value }, "PATCH");
                });
              }
            }}
            disabled={busy}
            className="case-input"
          />
        </label>
      </div>

      {/* Dedicated, Full-Width SLA Response Deadline Card */}
      <div className="case-deadline-card">
        <div className="case-deadline-header">
          <div className="case-deadline-title-group">
            <Clock size={15} className="case-deadline-icon" />
            <div>
              <strong className="case-deadline-title">Response deadline · SLA Target</strong>
              {existingDeadline ? (
                <span className={`case-deadline-meta ${isOverdue ? "overdue" : "active"}`}>
                  {isOverdue ? "Overdue · " : "Target: "}
                  {new Date(existingDeadline).toLocaleString([], {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              ) : (
                <span className="case-deadline-meta unassigned">No SLA response deadline configured</span>
              )}
            </div>
          </div>
        </div>

        <div className="case-deadline-controls">
          <div className="case-deadline-picker-wrap">
            <fieldset
              className="hotel-form-lock"
              disabled={busy}
              style={{ width: "100%", margin: 0, padding: 0, border: "none" }}
            >
              <WorkspaceDateField
                key={`${id}-${existingDeadline || "none"}`}
                label="Response deadline"
                mode="datetime"
                value={deadline}
                onChange={(val) => {
                  setDeadline(val);
                  setDeadlineSuccess(false);
                }}
              />
            </fieldset>
          </div>
          <button
            type="button"
            className="button button-dark case-deadline-btn"
            disabled={busy || !deadline || deadline === existingDeadline}
            onClick={() =>
              perform(async () => {
                await send(
                  "/api/feedback/" + id,
                  { deadline: new Date(deadline).toISOString() },
                  "PATCH"
                );
                setDeadlineSuccess(true);
              })
            }
          >
            {busy ? "Saving…" : "Set deadline"}
          </button>
        </div>

        {deadlineSuccess && (
          <p className="case-deadline-success">✓ SLA response deadline updated successfully.</p>
        )}
      </div>

      {/* Internal note form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          perform(async () => {
            await send("/api/cases/" + id, { body: note });
            setNote("");
          });
        }}
        className="case-form-section"
      >
        <label className="case-field-label">
          <span>Internal note</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={4000}
            required
            rows={3}
            placeholder="Add an internal note visible to hotel staff…"
            className="case-textarea"
          />
        </label>
        <button className="button button-dark" disabled={busy || !note.trim()}>
          Add note
        </button>
      </form>

      {/* Resolution notes */}
      {data && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const notes = new FormData(e.currentTarget).get("resolution");
            perform(async () => {
              await send("/api/feedback/" + id, { notes }, "PATCH");
            });
          }}
          className="case-form-section"
        >
          <label className="case-field-label">
            <span>Resolution notes</span>
            <textarea
              key={data.record.resolution_notes}
              name="resolution"
              defaultValue={data.record.resolution_notes || ""}
              maxLength={4000}
              rows={3}
              placeholder="Action taken to recover guest satisfaction…"
              className="case-textarea"
            />
          </label>
          <button className="button button-ghost" disabled={busy}>
            Save resolution notes
          </button>
        </form>
      )}

      {/* Attachment upload */}
      <label className="platform-upload case-upload-label">
        <span>Private attachment · JPG, PNG, PDF or TXT, up to 5 MB</span>
        <input
          type="file"
          accept=".jpg,.jpeg,.png,.pdf,.txt"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              perform(async () => {
                const body = new FormData();
                body.append("file", file);
                await send("/api/cases/" + id, body);
              });
            }
            e.target.value = "";
          }}
        />
      </label>

      {!data && !error && <p role="status">Loading case history…</p>}

      {data?.attachments?.length > 0 && (
        <div className="case-attachments-list">
          {data.attachments.map((a: any) => (
            <button
              className="button button-ghost case-attachment-btn"
              key={a.id}
              onClick={() =>
                perform(async () => {
                  const j = await fetch("/api/cases/" + id + "?download=" + a.id).then((r) =>
                    r.json()
                  );
                  if (!j.success) throw new Error(j.error);
                  window.location.assign(j.url);
                })
              }
            >
              {a.filename} · {Math.ceil(a.size_bytes / 1024)} KB
            </button>
          ))}
        </div>
      )}

      {/* Activity Timeline */}
      {((data?.comments?.length || 0) + (data?.activity?.length || 0)) > 0 && (
        <ol className="case-timeline">
          {[...(data?.comments || []), ...(data?.activity || [])]
            .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
            .map((a: any) => (
              <li key={a.id}>
                <strong>{a.body ? "Internal note" : a.action}</strong>
                <small>
                  {new Date(a.created_at).toLocaleString()} ·{" "}
                  {a.profiles?.full_name || a.actor_name || "System"}
                </small>
                {a.body ? (
                  <p>{a.body}</p>
                ) : (
                  Object.entries(a.changes || {}).map(([key, value]: [string, any]) => (
                    <p key={key}>
                      {key.replaceAll("_", " ")}:{" "}
                      {typeof value === "object"
                        ? String(value?.from ?? "—") + " → " + String(value?.to ?? "—")
                        : String(value)}
                    </p>
                  ))
                )}
              </li>
            ))}
        </ol>
      )}
    </section>
  );
}
