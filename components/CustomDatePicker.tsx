"use client";

import { useState, useRef, useEffect } from "react";
import { Calendar as CalendarIcon, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {createPortal} from "react-dom";

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
  selectionMode="range",
  label,
  floating=false,
  minDate,
  maxDate,
}: {
  value: DateRangeFilter;
  onChange: (val: DateRangeFilter) => void;
  selectionMode?:"range"|"single"|"month";
  label?:string;
  floating?:boolean;
  minDate?:string;
  maxDate?:string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef=useRef<HTMLDivElement>(null);
  const [position,setPosition]=useState<React.CSSProperties>({});
  useEffect(()=>{
    if(!isOpen)return;
    setTempStart(value.startDate);setTempEnd(value.endDate);
    if(value.startDate){const [y,m,d]=value.startDate.split("-").map(Number);setViewDate(new Date(y,m-1,d||1));}
  },[isOpen,value.startDate,value.endDate]);
  useEffect(()=>{
    if(!isOpen||!floating)return;
    const place=()=>{
      const node=containerRef.current;if(!node)return;
      const rect=node.getBoundingClientRect(),width=Math.min(selectionMode==="range"?460:292,window.innerWidth-16),room=window.innerHeight-rect.bottom;
      const palette=getComputedStyle(node),accents:Record<string,string>={};
      for(const key of ["--sage","--sage-deep","--sage-soft","--sage-hover","--module-accent","--scroll-thumb"])accents[key]=palette.getPropertyValue(key);
      setPosition({...accents,position:"fixed",width,left:Math.max(8,Math.min(rect.left,window.innerWidth-width-8)),top:room>=300?rect.bottom+6:"auto",bottom:room<300?Math.max(8,window.innerHeight-rect.top+6):"auto",right:"auto",maxHeight:Math.max(100,Math.min(420,room>=300?room-14:rect.top-14)),overflowY:"auto",zIndex:1400});
    };
    place();window.addEventListener("resize",place);window.addEventListener("scroll",place,true);
    return()=>{window.removeEventListener("resize",place);window.removeEventListener("scroll",place,true);};
  },[isOpen,floating,selectionMode]);

  // Calendar display state
  const [viewDate, setViewDate] = useState(() => new Date());
  const [tempStart, setTempStart] = useState<string | null>(value.startDate);
  const [tempEnd, setTempEnd] = useState<string | null>(value.endDate);
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)&&!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      const handleEscape = (event: KeyboardEvent) => {
        if (event.key === "Escape") setIsOpen(false);
      };
      document.addEventListener("keydown", handleEscape);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("keydown", handleEscape);
      };
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
    setViewDate(selectionMode==="month"?new Date(year-1,month,1):new Date(year, month - 1, 1));
  };
  const nextMonth = () => {
    setViewDate(selectionMode==="month"?new Date(year+1,month,1):new Date(year, month + 1, 1));
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  const handleDayClick = (day: number) => {
    const ymd = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if(selectionMode==="single"){onChange({preset:"custom",startDate:ymd,endDate:ymd});setIsOpen(false);return;}

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

  const calendar=(
          <motion.div
            ref={menuRef}
            className={`custom-datepicker-popover ${selectionMode!=="range"?"datepicker-single":""}`}
            style={floating?position:undefined}
            role="dialog" aria-label={label||"Choose dates"}
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
          >
            {/* Presets Sidebar */}
            {selectionMode==="range"&&<div className="datepicker-presets">
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
            </div>}

            {/* Interactive Calendar */}
            <div className="datepicker-calendar-panel">
              <div className="calendar-header">
                <button
                  type="button"
                  className="calendar-nav-btn"
                  onClick={prevMonth}
                  aria-label={selectionMode==="month"?"Previous year":"Previous month"}
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="calendar-month-title">
                  {selectionMode!=="month"&&monthNames[month]} {year}
                </span>
                <button
                  type="button"
                  className="calendar-nav-btn"
                  onClick={nextMonth}
                  aria-label={selectionMode==="month"?"Next year":"Next month"}
                >
                  <ChevronRight size={14} />
                </button>
              </div>

              {selectionMode==="month"?<div className="calendar-months-grid">{monthNames.map((name,i)=>{const date=`${year}-${String(i+1).padStart(2,"0")}-01`;return <button type="button" key={name} className={`calendar-month-option ${value.startDate?.slice(0,7)===date.slice(0,7)?"selected":""}`} onClick={()=>{onChange({preset:"custom",startDate:date,endDate:date});setIsOpen(false);}}>{name.slice(0,3)}</button>;})}</div>:<><div className="calendar-weekdays">
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
                      aria-label={dayYmd}
                      aria-pressed={isStart||isEnd}
                      disabled={!!(minDate&&dayYmd<minDate||maxDate&&dayYmd>maxDate)}
                      className={`calendar-day ${isStart ? "day-start" : ""} ${isEnd ? "day-end" : ""} ${inRange ? "day-in-range" : ""}`}
                      onClick={() => handleDayClick(day)}
                      onMouseEnter={() => setHoverDate(dayYmd)}
                      onMouseLeave={() => setHoverDate(null)}
                    >
                      {day}
                    </button>
                  );
                })}
              </div></>}

              {selectionMode==="range"&&<div className="datepicker-footer">
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
              </div>}
            </div>
          </motion.div>
  );
  return <div className="custom-datepicker-container" ref={containerRef} style={{position:"relative"}}>
    <button
      type="button"
      className={`custom-datepicker-trigger ${value.preset!=="all"?"active":""}`}
      onClick={()=>setIsOpen(!isOpen)}
      aria-label={label||"Select date range"}
      aria-expanded={isOpen}
      aria-haspopup="dialog"
    >
      <CalendarIcon size={14} className="datepicker-icon" style={{ flexShrink: 0 }} />
      <span className="datepicker-label">
        {selectionMode==="range"
          ? getPresetLabel(value)
          : value.startDate
          ? selectionMode==="month"
            ? new Date(value.startDate+"T12:00:00").toLocaleDateString(undefined,{month:"short",year:"numeric"})
            : new Date(value.startDate+"T12:00:00").toLocaleDateString()
          : "Choose date"}
      </span>
      <ChevronDown
        size={13}
        className="datepicker-chevron"
        style={{
          flexShrink: 0,
          marginLeft: "2px",
          transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
          transition: "transform 0.16s ease",
        }}
      />
    </button>
    {floating?typeof document!=="undefined"&&createPortal(<AnimatePresence>{isOpen&&calendar}</AnimatePresence>,containerRef.current?.closest('dialog,[role="dialog"]')||document.body):<AnimatePresence>{isOpen&&calendar}</AnimatePresence>}
  </div>;
}
