"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import CustomDatePicker from "./CustomDatePicker";
import CustomTimePicker from "./CustomTimePicker";

export default function WorkspaceDateField({
  name,
  label,
  mode = "date",
  required = false,
  value,
  onChange,
  minDate,
}: {
  name?: string;
  label: string;
  mode?: "date" | "datetime" | "month";
  required?: boolean;
  value?: string;
  onChange?: (value: string) => void;
  minDate?: string;
}) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [invalid, setInvalid] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value && mode === "datetime" && value.includes("T")) {
      const parts = value.split("T");
      if (parts[0]) setDate(parts[0]);
      if (parts[1]) setTime(parts[1].slice(0, 5));
    }
  }, [value, mode]);

  const rawDate = value === undefined ? date : mode === "month" && value ? value + "-01" : value.includes("T") ? value.split("T")[0] : value;
  const selected = rawDate;
  const serialized = selected
    ? mode === "datetime"
      ? selected + "T" + time
      : mode === "month"
      ? selected.slice(0, 7)
      : selected
    : "";

  useEffect(() => {
    const form = root.current?.closest("form");
    const reset = () => {
      setDate("");
      setTime("09:00");
      setInvalid(false);
    };
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, []);

  return (
    <div className="workspace-date-field" ref={root}>
      <div className="workspace-date-inputs">
        <CustomDatePicker
          label={label}
          selectionMode={mode === "month" ? "month" : "single"}
          floating
          minDate={minDate}
          value={{
            preset: selected ? "custom" : "all",
            startDate: selected || null,
            endDate: selected || null,
          }}
          onChange={(next) => {
            const nextDate = next.startDate || "";
            setDate(nextDate);
            setInvalid(false);
            onChange?.(
              mode === "month"
                ? nextDate.slice(0, 7)
                : mode === "datetime" && nextDate
                ? nextDate + "T" + time
                : nextDate
            );
          }}
        />

        {mode === "datetime" && (
          <CustomTimePicker
            value={time}
            label={label + " time"}
            onChange={(newTime) => {
              setTime(newTime);
              onChange?.(selected && newTime ? selected + "T" + newTime : "");
            }}
          />
        )}
      </div>

      {selected && !required && mode !== "month" && (
        <button
          type="button"
          className="date-field-clear"
          aria-label={"Clear " + label.toLowerCase()}
          onClick={() => {
            setDate("");
            setInvalid(false);
            onChange?.("");
          }}
          title={"Clear " + label.toLowerCase()}
        >
          <X size={11} strokeWidth={2} />
          <span>Clear</span>
        </button>
      )}

      {name && (
        <input
          className="date-field-validity"
          aria-label={label + " value"}
          name={name}
          value={serialized}
          onChange={() => {}}
          required={required}
          tabIndex={-1}
          onInvalid={(event) => {
            event.preventDefault();
            setInvalid(true);
            root.current?.querySelector("button")?.focus();
          }}
        />
      )}

      {invalid && <small role="alert">Choose {label.toLowerCase()}.</small>}
    </div>
  );
}
