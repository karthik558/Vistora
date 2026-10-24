"use client";

import { useState, useRef, useEffect } from "react";
import { Calendar as CalendarIcon, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export type DatePreset = "all" | "today" | "yesterday" | "7d" | "30d" | "month" | "custom";

export interface DateRangeFilter {
  preset: DatePreset;
  startDate: string | null; // "YYYY-MM-DD"
  endDate: string | null;   // "YYYY-MM-DD"
}

export function isDateInRange(dateStr?: string | null, filter?: DateRangeFilter): boolean {
  if (!filter || filter.preset === "all") return true;
  if (!dateStr) return false;

  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return true;

  const now = new Date();

  if (filter.preset === "today") {
    return d.toDateString() === now.toDateString();
  }

  if (filter.preset === "yesterday") {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return d.toDateString() === yesterday.toDateString();
  }

  if (filter.preset === "7d") {
    const past7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return d >= past7;
  }

  if (filter.preset === "30d") {
    const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return d >= past30;
  }

  if (filter.preset === "month") {
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }

  if (filter.preset === "custom") {
    if (filter.startDate && filter.endDate) {
      const start = new Date(filter.startDate + "T00:00:00");
      const end = new Date(filter.endDate + "T23:59:59");
      return d >= start && d <= end;
    }
    if (filter.startDate) {
      const start = new Date(filter.startDate + "T00:00:00");
      return d >= start;
    }
  }

  return true;
}

export function getPresetLabel(filter: DateRangeFilter): string {
  switch (filter.preset) {
    case "today":
      return "Today";
    case "yesterday":
      return "Yesterday";
    case "7d":
      return "Last 7 days";
    case "30d":
      return "Last 30 days";
    case "month":
      return "This month";
    case "custom":
      if (filter.startDate && filter.endDate) {
        return `${formatDisplayDate(filter.startDate)} – ${formatDisplayDate(filter.endDate)}`;
      }
      if (filter.startDate) {
        return `From ${formatDisplayDate(filter.startDate)}`;
      }
      return "Custom range";
    case "all":
    default:
      return "All time";
  }
}

function formatDisplayDate(isoYmd: string): string {
  try {
    const parts = isoYmd.split("-");
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return isoYmd;
  }
}

function toYMD(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function CustomDatePicker({
  value,
  onChange,
}: {
  value: DateRangeFilter;
  onChange: (val: DateRangeFilter) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calendar display state
  const [viewDate, setViewDate] = useState(() => new Date());
  const [tempStart, setTempStart] = useState<string | null>(value.startDate);
  const [tempEnd, setTempEnd] = useState<string | null>(value.endDate);
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const presets: { id: DatePreset; label: string }[] = [
    { id: "all", label: "All time" },
    { id: "today", label: "Today" },
    { id: "yesterday", label: "Yesterday" },
    { id: "7d", label: "Last 7 days" },
    { id: "30d", label: "Last 30 days" },
    { id: "month", label: "This month" },
    { id: "custom", label: "Custom range" },
  ];

  const handleSelectPreset = (p: DatePreset) => {
    const now = new Date();
    if (p === "all") {
      onChange({ preset: "all", startDate: null, endDate: null });
      setIsOpen(false);
      return;
    }
    if (p === "today") {
      const today = toYMD(now);
      onChange({ preset: "today", startDate: today, endDate: today });
      setIsOpen(false);
      return;
    }
    if (p === "yesterday") {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yesterday = toYMD(y);
      onChange({ preset: "yesterday", startDate: yesterday, endDate: yesterday });
      setIsOpen(false);
      return;
    }
    if (p === "7d") {
      const p7 = new Date(now);
      p7.setDate(p7.getDate() - 7);
      onChange({ preset: "7d", startDate: toYMD(p7), endDate: toYMD(now) });
      setIsOpen(false);
      return;
    }
    if (p === "30d") {
      const p30 = new Date(now);
      p30.setDate(p30.getDate() - 30);
      onChange({ preset: "30d", startDate: toYMD(p30), endDate: toYMD(now) });
      setIsOpen(false);
      return;
    }
    if (p === "month") {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      onChange({ preset: "month", startDate: toYMD(first), endDate: toYMD(now) });
      setIsOpen(false);
      return;
    }
    // "custom"
    setTempStart(value.startDate);
    setTempEnd(value.endDate);
  };

  // Calendar helpers
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => {
    setViewDate(new Date(year, month - 1, 1));
  };
  const nextMonth = () => {
    setViewDate(new Date(year, month + 1, 1));
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  const handleDayClick = (day: number) => {
    const ymd = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    if (!tempStart || (tempStart && tempEnd)) {
      setTempStart(ymd);
      setTempEnd(null);
    } else {
      if (ymd < tempStart) {
        setTempEnd(tempStart);
        setTempStart(ymd);
      } else {
        setTempEnd(ymd);
      }
    }
  };

  const applyCustomRange = () => {
    if (tempStart && tempEnd) {
      onChange({
        preset: "custom",
        startDate: tempStart,
        endDate: tempEnd,
      });
      setIsOpen(false);
    } else if (tempStart) {
      onChange({
        preset: "custom",
        startDate: tempStart,
        endDate: tempStart,
      });
      setIsOpen(false);
    }
  };

  return (
    <div className="custom-datepicker-container" ref={containerRef} style={{ position: "relative" }}>
      <button
        type="button"
        className={`custom-datepicker-trigger ${value.preset !== "all" ? "active" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Select date range"
      >
        <CalendarIcon size={14} className="datepicker-icon" />
        <span className="datepicker-label">{getPresetLabel(value)}</span>
        <ChevronDown size={13} className="datepicker-chevron" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="custom-datepicker-popover"
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
          >
            {/* Presets Sidebar */}
            <div className="datepicker-presets">
              <span className="datepicker-section-title">Range presets</span>
              {presets.map((preset) => (
                <button
                  type="button"
                  key={preset.id}
                  className={`datepicker-preset-btn ${value.preset === preset.id ? "selected" : ""}`}
                  onClick={() => handleSelectPreset(preset.id)}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Interactive Calendar */}
            <div className="datepicker-calendar-panel">
              <div className="calendar-header">
                <button
                  type="button"
                  className="calendar-nav-btn"
                  onClick={prevMonth}
                  aria-label="Previous month"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="calendar-month-title">
                  {monthNames[month]} {year}
                </span>
                <button
                  type="button"
                  className="calendar-nav-btn"
                  onClick={nextMonth}
                  aria-label="Next month"
                >
                  <ChevronRight size={14} />
                </button>
              </div>

              <div className="calendar-weekdays">
                <span>Su</span>
                <span>Mo</span>
                <span>Tu</span>
                <span>We</span>
                <span>Th</span>
                <span>Fr</span>
                <span>Sa</span>
              </div>

              <div className="calendar-days-grid">
                {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                  <div key={`empty-${i}`} className="calendar-day empty" />
                ))}

                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const dayYmd = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

                  const isStart = tempStart === dayYmd;
                  const isEnd = tempEnd === dayYmd;
                  const inRange =
                    (tempStart && tempEnd && dayYmd > tempStart && dayYmd < tempEnd) ||
                    (tempStart && !tempEnd && hoverDate && dayYmd > tempStart && dayYmd <= hoverDate);

                  return (
                    <button
                      type="button"
                      key={day}
                      className={`calendar-day ${isStart ? "day-start" : ""} ${isEnd ? "day-end" : ""} ${inRange ? "day-in-range" : ""}`}
                      onClick={() => handleDayClick(day)}
                      onMouseEnter={() => setHoverDate(dayYmd)}
                      onMouseLeave={() => setHoverDate(null)}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>

              <div className="datepicker-footer">
                <span className="datepicker-summary">
                  {tempStart && tempEnd
                    ? `${formatDisplayDate(tempStart)} – ${formatDisplayDate(tempEnd)}`
                    : tempStart
                    ? `From ${formatDisplayDate(tempStart)}`
                    : "Select date range"}
                </span>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    type="button"
                    className="button button-outline compact"
                    onClick={() => {
                      setTempStart(null);
                      setTempEnd(null);
                      onChange({ preset: "all", startDate: null, endDate: null });
                      setIsOpen(false);
                    }}
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    className="button button-dark compact"
                    onClick={applyCustomRange}
                    disabled={!tempStart}
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
