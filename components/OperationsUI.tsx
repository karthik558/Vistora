"use client";
import WorkspaceSelect from "./WorkspaceSelect";
import {
  FormEvent,
  ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { OpsRow } from "../lib/omniops/types";
export function Status({ value }: { value: string }) {
  return (
    <span className={`ops-status status-${value}`}>
      {({ normal: "Standard", high: "Urgent" } as Record<string, string>)[
        value
      ] || value.replaceAll("_", " ")}
    </span>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return <p className="ops-empty">{children}</p>;
}
export function Dialog({
  title,
  onClose,
  children,
  busy = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null),
    heading = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return createPortal(
    <div
      className="ops-dialog-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={ref}
        className="ops-dialog platform-page"
        role="dialog"
        aria-modal="true"
        aria-labelledby={heading}
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === "Escape" && !busy) onClose();
          if (e.key === "Tab") {
            const items = ref.current?.querySelectorAll<HTMLElement>(
              'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]',
            );
            if (!items?.length) {
              e.preventDefault();
              return;
            }
            const first = items[0],
              last = items[items.length - 1];
            if (
              e.shiftKey &&
              (document.activeElement === first ||
                document.activeElement === ref.current)
            ) {
              e.preventDefault();
              last.focus();
            } else if (
              !e.shiftKey &&
              (document.activeElement === last ||
                document.activeElement === ref.current)
            ) {
              e.preventDefault();
              first.focus();
            }
          }
        }}
      >
        <div className="ops-dialog-heading">
          <h2 id={heading}>{title}</h2>
          <button
            type="button"
            className="ops-icon-button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
export type Field = {
  name: string;
  label: string;
  type?: "text" | "number" | "textarea" | "select" | "datetime-local";
  required?: boolean;
  min?: number;
  max?: number;
  options?: { value: string; label: string }[];
  value?: string | number;
  hint?: string;
};
export type FormSpec = {
  title: string;
  action: string;
  fields: Field[];
  description?: string;
  defaults?: Record<string, unknown>;
  submit?: string;
};
export type Mutate = (
  action: string,
  data: Record<string, unknown>,
  legacy?: boolean,
) => Promise<any>;
export function RecordForm({
  spec,
  property,
  busy,
  onSave,
  onClose,
  saveError,
}: {
  spec: FormSpec;
  property: string;
  busy: boolean;
  onSave: Mutate;
  onClose: () => void;
  saveError?: string;
}) {
  const [error, setError] = useState("");
  const formId = useId();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const data: Record<string, unknown> = {
      ...spec.defaults,
      property_id: property,
      ...Object.fromEntries(new FormData(e.currentTarget)),
    };
    for (const f of spec.fields) {
      if (f.type === "number") data[f.name] = Number(data[f.name]);
      if (f.type === "datetime-local" && data[f.name])
        data[f.name] = new Date(String(data[f.name])).toISOString();
    }
    if (spec.action === "template")
      data.checks = String(data.checks)
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
    const result = await onSave(spec.action, data);
    if (result) onClose();
    else
      setError(
        "This record was not saved. Review the error on the page and try again.",
      );
  }
  return (
    <Dialog title={spec.title} onClose={onClose} busy={busy}>
      {spec.description && <p>{spec.description}</p>}
      <form onSubmit={submit} className="ops-form">
        {spec.fields.map((f) => (
          <div className="ops-field-label" key={f.name}>
            {f.type === "select" ? (
              <span>{f.label}</span>
            ) : (
              <label htmlFor={`${formId}-${f.name}`}>{f.label}</label>
            )}
            {f.type === "select" ? (
              <WorkspaceSelect
                label={f.label}
                name={f.name}
                defaultValue={String(f.value ?? "")}
                required={f.required !== false}
                options={[
                  ...(f.required === false
                    ? [{ value: "", label: "None" }]
                    : []),
                  ...(f.options || []),
                ]}
              />
            ) : f.type === "textarea" ? (
              <textarea
                aria-label={f.label}
                id={`${formId}-${f.name}`}
                name={f.name}
                defaultValue={f.value ?? ""}
                rows={4}
                required={f.required !== false}
                maxLength={f.name === "checks" ? 6000 : 2000}
              />
            ) : (
              <input
                aria-label={f.label}
                id={`${formId}-${f.name}`}
                name={f.name}
                type={f.type || "text"}
                defaultValue={f.value ?? ""}
                min={f.min}
                max={f.max}
                step={f.type === "number" ? 1 : undefined}
                required={f.required !== false}
                maxLength={f.name === "reason" ? 1000 : 160}
              />
            )}{" "}
            {(f.hint || f.type === "datetime-local") && (
              <small>
                {f.hint ||
                  `Times use this device’s time zone (${Intl.DateTimeFormat().resolvedOptions().timeZone}) and are saved in UTC.`}
              </small>
            )}
          </div>
        ))}
        {(saveError || error) && <p role="alert">{saveError || error}</p>}
        <div className="ops-form-actions">
          <button
            type="button"
            className="button button-ghost"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button className="button button-dark" disabled={busy}>
            {busy ? "Saving…" : spec.submit || "Save"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
export function RoomLabel({
  roomId,
  rooms,
}: {
  roomId: string | null;
  rooms: OpsRow[];
}) {
  return (
    <>{rooms.find((r) => r.id === roomId)?.room_number || "Public area"}</>
  );
}
