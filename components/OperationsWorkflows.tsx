"use client";
import { FormEvent, useState } from "react";
import { Job, OperationsData } from "../lib/omniops/types";
import { Dialog, Empty, Mutate, RoomLabel, Status } from "./OperationsUI";
import { money } from "../lib/hospitality/config";
export function CleaningChecklist({
  job,
  data,
  busy,
  mutate,
  onClose,
  saveError,
}: {
  job: Job;
  data: OperationsData;
  busy: boolean;
  mutate: Mutate;
  onClose: () => void;
  saveError?: string;
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>({}),
    [localError, setLocalError] = useState("");
  const catalog = data.catalog.filter(
    (i) => i.property_id === job.property_id && i.is_active,
  );
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fields = new FormData(e.currentTarget);
    const result = await mutate("cleaning", {
      property_id: job.property_id,
      job_id: job.id,
      access_confirmed: fields.has("access"),
      linen_changed: fields.has("linen"),
      amenities_restocked: fields.has("amenities"),
      minibar_restocked: fields.has("minibar_restocked"),
      minibar: catalog.map((i) => ({
        item_id: i.id,
        quantity: quantities[i.id] || 0,
      })),
    });
    if (result) onClose();
    else
      setLocalError(
        "Cleaning was not completed. Check the page error and try again.",
      );
  }
  return (
    <Dialog title="Complete room cleaning" busy={busy} onClose={onClose}>
      <p>
        Room <RoomLabel roomId={job.room_id} rooms={data.rooms} /> · {job.title}
      </p>
      <form onSubmit={submit} className="ops-form">
        <label className="ops-check">
          <input type="checkbox" name="access" required />
          Room access and do-not-disturb checked
        </label>
        <label className="ops-check">
          <input type="checkbox" name="linen" required />
          Linen changed
        </label>
        <label className="ops-check">
          <input type="checkbox" name="amenities" required />
          Amenities restocked
        </label>
        <div>
          <h3>Minibar consumption</h3>
          <p>
            Record consumed items, then restock to the listed par level. Charges
            use the configured price and await manager approval.
          </p>
          {!catalog.length ? (
            <Empty>No minibar catalog for this property.</Empty>
          ) : (
            catalog.map((item) => (
              <div className="ops-counter-row" key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <small>
                    {money(item.price_minor, item.currency)} each · restock to{" "}
                    {item.par_level}
                  </small>
                </div>
                <div className="ops-counter">
                  <button
                    type="button"
                    aria-label={`Decrease ${item.name} consumed`}
                    disabled={!quantities[item.id] || busy}
                    onClick={() =>
                      setQuantities((q) => ({
                        ...q,
                        [item.id]: Math.max(0, (q[item.id] || 0) - 1),
                      }))
                    }
                  >
                    −
                  </button>
                  <output aria-label={`${item.name} consumed`}>
                    {quantities[item.id] || 0}
                  </output>
                  <button
                    type="button"
                    aria-label={`Increase ${item.name} consumed`}
                    disabled={
                      (quantities[item.id] || 0) >= item.par_level || busy
                    }
                    onClick={() =>
                      setQuantities((q) => ({
                        ...q,
                        [item.id]: (q[item.id] || 0) + 1,
                      }))
                    }
                  >
                    +
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        {catalog.length > 0 && (
          <label className="ops-check">
            <input type="checkbox" name="minibar_restocked" required />
            Minibar restocked to par
          </label>
        )}
        {(saveError || localError) && (
          <p role="alert">{saveError || localError}</p>
        )}
        <button className="button button-dark" disabled={busy}>
          {busy ? "Saving…" : "Complete cleaning"}
        </button>
      </form>
    </Dialog>
  );
}
export function InspectionWorkflow({
  data,
  property,
  busy,
  mutate,
  onNewTemplate,
  canManage,
}: {
  data: OperationsData;
  property: string;
  busy: boolean;
  mutate: Mutate;
  onNewTemplate: () => void;
  canManage: boolean;
}) {
  const [template, setTemplate] = useState(""),
    [room, setRoom] = useState(""),
    [answers, setAnswers] = useState<Record<string, boolean>>({}),
    [evidence, setEvidence] = useState<Record<string, string>>({}),
    [uploading, setUploading] = useState(""),
    [error, setError] = useState("");
  const checks: string[] =
    data.templates.find((t) => t.id === template)?.checks ||
    data.defaultChecklist;
  async function upload(label: string, file: File) {
    setUploading(label);
    setError("");
    try {
      const form = new FormData();
      form.set("photo", file);
      form.set("property_id", property);
      form.set("check_label", label);
      const response = await fetch("/api/operations/evidence", {
        method: "POST",
        body: form,
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Photo upload failed.");
      setEvidence((e) => ({ ...e, [label]: body.id }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading("");
    }
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (checks.some((label) => answers[label] === undefined)) {
      setError("Choose passed or failed for every inspection point.");
      return;
    }
    const form = e.currentTarget,
      fields = new FormData(form);
    const result = await mutate("inspection", {
      property_id: property,
      room_id: room || null,
      template_id: template || null,
      location: fields.get("location") || "",
      notes: fields.get("notes"),
      answers: checks.map((label) => ({ label, passed: answers[label] })),
      evidence_ids: checks
        .filter((label) => !answers[label] && evidence[label])
        .map((label) => evidence[label]),
    });
    if (result) {
      form.reset();
      setRoom("");
      setAnswers({});
      setEvidence({});
    } else setError("The inspection was not saved. Review the page error.");
  }
  async function photo(id: string) {
    try {
      const response = await fetch(
        "/api/operations/evidence?id=" + encodeURIComponent(id),
      );
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      window.open(body.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      {canManage && (
        <section className="platform-card">
          <div className="ops-section-heading">
            <div>
              <h2>Quality inspection</h2>
              <p>
                Every failed inspection creates a linked maintenance job.
                Records and checklist versions remain immutable.
              </p>
            </div>
            <button
              className="button button-outline"
              onClick={onNewTemplate}
              disabled={property === "all"}
            >
              Build checklist
            </button>
          </div>
          {property === "all" ? (
            <Empty>Choose one property to record an inspection.</Empty>
          ) : (
            <form className="ops-form" onSubmit={submit}>
              <div className="ops-fields">
                <label>
                  Checklist
                  <select
                    value={template}
                    onChange={(e) => {
                      setTemplate(e.target.value);
                      setAnswers({});
                      setEvidence({});
                    }}
                  >
                    <option value="">Workspace default</option>
                    {data.templates
                      .filter((t) => t.property_id === property)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Room
                  <select
                    value={room}
                    onChange={(e) => setRoom(e.target.value)}
                  >
                    <option value="">Public area</option>
                    {data.rooms
                      .filter((r) => r.property_id === property)
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.room_number}
                        </option>
                      ))}
                  </select>
                </label>
                {!room && (
                  <label>
                    Public area
                    <input
                      name="location"
                      required
                      maxLength={100}
                      placeholder="Lobby, pool, corridor…"
                    />
                  </label>
                )}
              </div>
              <div className="ops-inspection-checks">
                {checks.map((label, index) => (
                  <div className="ops-inspection-point" key={label}>
                    <strong>
                      {index + 1}. {label}
                    </strong>
                    <div className="ops-choice" role="group" aria-label={label}>
                      {[true, false].map((passed) => (
                        <button
                          key={String(passed)}
                          type="button"
                          aria-pressed={answers[label] === passed}
                          className={
                            answers[label] === passed
                              ? passed
                                ? "selected-pass"
                                : "selected-fail"
                              : ""
                          }
                          onClick={() =>
                            setAnswers((a) => ({ ...a, [label]: passed }))
                          }
                        >
                          {passed ? "Passed" : "Failed"}
                        </button>
                      ))}
                    </div>
                    {answers[label] === false && (
                      <label className="ops-photo-input">
                        {evidence[label]
                          ? "Photo attached"
                          : "Attach photo of failed point"}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          capture="environment"
                          disabled={!!uploading || !!evidence[label]}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) upload(label, file);
                          }}
                        />
                        {uploading === label && (
                          <small role="status">Uploading…</small>
                        )}
                      </label>
                    )}
                  </div>
                ))}
              </div>
              <label>
                Inspection notes
                <textarea name="notes" rows={3} maxLength={2000} />
              </label>
              <button
                className="button button-dark"
                disabled={busy || !!uploading}
              >
                {busy ? "Recording…" : "Record inspection"}
              </button>
            </form>
          )}
        </section>
      )}
      {error && (
        <p className="platform-notice" role="alert">
          {error}
        </p>
      )}
      <section className="platform-card">
        <h2>Inspection history</h2>
        {!data.inspections.length ? (
          <Empty>No inspections recorded.</Empty>
        ) : (
          data.inspections.map((i) => (
            <details className="ops-inspection-record" key={i.id}>
              <summary>
                <span>
                  {i.room_id
                    ? `Room ${data.rooms.find((r) => r.id === i.room_id)?.room_number || "—"}`
                    : i.location || "Public area"}{" "}
                  · {new Date(i.created_at).toLocaleString()}
                </span>
                <Status value={i.passed ? "completed" : "critical"} />
              </summary>
              <ul>
                {i.answers.map((a: any) => (
                  <li key={a.label}>
                    {a.passed ? "Passed" : "Failed"} · {a.label}
                    {data.evidence
                      .filter(
                        (e) =>
                          e.inspection_id === i.id && e.check_label === a.label,
                      )
                      .map((e) => (
                        <button
                          key={e.id}
                          className="button button-ghost"
                          onClick={() => photo(e.id)}
                        >
                          View photo
                        </button>
                      ))}
                  </li>
                ))}
              </ul>
              {i.notes && <p>{i.notes}</p>}
            </details>
          ))
        )}
      </section>
    </>
  );
}
