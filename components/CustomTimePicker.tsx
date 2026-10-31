"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Clock, ChevronDown, Check, Search, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export interface CustomTimePickerProps {
  value: string; // "HH:mm" (24h)
  onChange: (value: string) => void;
  label?: string;
  disabled?: boolean;
  floating?: boolean;
  className?: string;
}

// Format "HH:mm" to "hh:mm AM/PM"
function format12h(val: string): string {
  if (!val) return "Select time";
  const parts = val.split(":");
  let h = parseInt(parts[0], 10);
  let m = parseInt(parts[1], 10);
  if (isNaN(h)) h = 9;
  if (isNaN(m)) m = 0;
  const isPm = h >= 12;
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const mStr = String(m).padStart(2, "0");
  const hStr = String(h12).padStart(2, "0");
  return `${hStr}:${mStr} ${isPm ? "PM" : "AM"}`;
}

// Generate standard 15-minute time intervals across 24 hours
function generateTimeSlots(): Array<{ value: string; label: string; detail?: string }> {
  const slots: Array<{ value: string; label: string; detail?: string }> = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const hStr = String(h).padStart(2, "0");
      const mStr = String(m).padStart(2, "0");
      const val = `${hStr}:${mStr}`;
      let detail: string | undefined;
      if (val === "09:00") detail = "Morning";
      else if (val === "12:00") detail = "Noon";
      else if (val === "17:00") detail = "End of day";
      else if (val === "21:00") detail = "Night";

      slots.push({
        value: val,
        label: format12h(val),
        detail,
      });
    }
  }
  return slots;
}

export default function CustomTimePicker({
  value = "09:00",
  onChange,
  label = "Select time",
  disabled = false,
  floating = true,
  className = "",
}: CustomTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [position, setPosition] = useState<React.CSSProperties>({});

  const allSlots = useMemo(() => generateTimeSlots(), []);

  // Filter slots if user types a search query
  const filteredSlots = useMemo(() => {
    if (!searchQuery.trim()) return allSlots;
    const q = searchQuery.toLowerCase().trim().replace(/\s+/g, "");
    return allSlots.filter((s) => {
      const cleanLabel = s.label.toLowerCase().replace(/\s+/g, "");
      const cleanVal = s.value.toLowerCase();
      return cleanLabel.includes(q) || cleanVal.includes(q) || s.detail?.toLowerCase().includes(q);
    });
  }, [allSlots, searchQuery]);

  useEffect(() => {
    if (!isOpen || !floating) return;
    function place() {
      const node = containerRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const width = Math.min(220, window.innerWidth - 16);
      const room = window.innerHeight - rect.bottom;
      const palette = getComputedStyle(node);
      const accents: Record<string, string> = {};
      for (const key of ["--sage", "--sage-deep", "--sage-soft", "--sage-hover", "--module-accent"]) {
        accents[key] = palette.getPropertyValue(key);
      }
      setPosition({
        ...accents,
        position: "fixed",
        width,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
        top: room >= 260 ? rect.bottom + 6 : "auto",
        bottom: room < 260 ? Math.max(8, window.innerHeight - rect.top + 6) : "auto",
        right: "auto",
        maxHeight: Math.max(100, Math.min(320, room >= 260 ? room - 14 : rect.top - 14)),
        overflowY: "auto",
        zIndex: 1400,
      });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [isOpen, floating]);

  // Auto-scroll to selected time when opened
  useEffect(() => {
    if (isOpen) {
      setSearchQuery("");
      setTimeout(() => {
        selectedItemRef.current?.scrollIntoView({ block: "center", behavior: "auto" });
      }, 50);
    }
  }, [isOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setIsOpen(false);
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        containerRef.current?.querySelector("button")?.focus();
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKey);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("keydown", handleKey);
      };
    }
  }, [isOpen]);

  function handleSelect(slotValue: string) {
    onChange(slotValue);
    setIsOpen(false);
  }

  const popover = (
    <motion.div
      ref={menuRef}
      className="custom-timepicker-popover custom-select-popover"
      style={{
        ...position,
        background: "var(--panel)",
        border: "1px solid var(--line)",
        borderRadius: "6px",
        boxShadow: "0 12px 32px rgba(15, 23, 19, 0.16), 0 2px 6px rgba(15, 23, 19, 0.04)",
        padding: "6px",
        fontFamily: "var(--font-dm-sans)",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
      }}
      role="dialog"
      aria-label={label}
      initial={{ opacity: 0, y: 4, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.98 }}
      transition={{ duration: 0.12, ease: "easeOut" }}
    >
      {/* Quick search input */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "6px 8px",
          borderBottom: "1px solid var(--line)",
          marginBottom: "2px",
        }}
      >
        <Search size={12} style={{ color: "var(--muted)", flexShrink: 0 }} />
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter time..."
          style={{
            border: "none",
            outline: "none",
            background: "transparent",
            fontSize: "12px",
            color: "var(--ink)",
            width: "100%",
            fontFamily: "inherit",
          }}
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              color: "var(--muted)",
            }}
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Scrollable list of simple time slots */}
      <div
        style={{
          maxHeight: "220px",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "1px",
        }}
      >
        {filteredSlots.length === 0 ? (
          <div style={{ padding: "12px", textAlign: "center", fontSize: "11px", color: "var(--muted)" }}>
            No matching time
          </div>
        ) : (
          filteredSlots.map((slot) => {
            const isSelected = value === slot.value;
            return (
              <button
                key={slot.value}
                ref={isSelected ? selectedItemRef : undefined}
                type="button"
                onClick={() => handleSelect(slot.value)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "7px 10px",
                  borderRadius: "4px",
                  border: "none",
                  background: isSelected ? "var(--sage-soft)" : "transparent",
                  color: isSelected ? "var(--sage-deep, var(--ink))" : "var(--ink)",
                  fontWeight: isSelected ? 600 : 400,
                  fontSize: "12px",
                  cursor: "pointer",
                  textAlign: "left",
                  width: "100%",
                  transition: "background 0.1s ease",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = "var(--canvas-alt, rgba(0,0,0,0.04))";
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.background = "transparent";
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                  <span>{slot.label}</span>
                  {slot.detail && (
                    <small style={{ fontSize: "10px", color: "var(--muted)", fontWeight: 400 }}>
                      · {slot.detail}
                    </small>
                  )}
                </div>

                {isSelected && (
                  <Check
                    size={13}
                    strokeWidth={2.2}
                    style={{ color: "var(--sage-deep, var(--module-accent))", flexShrink: 0 }}
                  />
                )}
              </button>
            );
          })
        )}
      </div>
    </motion.div>
  );

  return (
    <div
      ref={containerRef}
      className={`custom-timepicker-container ${className}`}
      style={{ position: "relative", minWidth: "100px", flex: "1 1 auto", maxWidth: "100%", boxSizing: "border-box" }}
    >
      <button
        type="button"
        disabled={disabled}
        className={`custom-timepicker-trigger custom-datepicker-trigger ${isOpen ? "active" : ""}`}
        onClick={() => {
          if (!disabled) setIsOpen(!isOpen);
        }}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        style={{
          width: "100%",
          minWidth: 0,
          minHeight: "36px",
          padding: "7px 10px",
          borderRadius: "4px",
          fontSize: "12px",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "6px",
          background: isOpen ? "var(--sage-soft)" : "var(--panel)",
          border: isOpen ? "1px solid var(--sage)" : "1px solid var(--line)",
          color: "var(--ink)",
          cursor: disabled ? "not-allowed" : "pointer",
          transition: "all 0.15s ease",
          boxShadow: "var(--shadow-xs)",
          overflow: "hidden",
          boxSizing: "border-box",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
            minWidth: 0,
          }}
        >
          <Clock size={13} style={{ color: isOpen ? "var(--module-accent, var(--sage-deep))" : "var(--muted)", flexShrink: 0 }} />
          <span
            style={{
              fontWeight: 500,
              fontSize: "12px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {format12h(value)}
          </span>
        </span>
        <ChevronDown
          size={12}
          style={{
            flexShrink: 0,
            marginLeft: "4px",
            color: "var(--muted)",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.16s ease",
          }}
        />
      </button>

      {floating
        ? typeof document !== "undefined" &&
          createPortal(
            <AnimatePresence>{isOpen && popover}</AnimatePresence>,
            containerRef.current?.closest('dialog,[role="dialog"]') || document.body
          )
        : <AnimatePresence>{isOpen && popover}</AnimatePresence>}
    </div>
  );
}
