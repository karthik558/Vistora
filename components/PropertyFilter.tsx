"use client";

import { useState, useRef, useEffect } from "react";
import { Building2, ChevronDown, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { PropertyRow } from "../types/experience";

export default function PropertyFilter({
  properties,
  selectedId,
  onChange,
}: {
  properties: PropertyRow[];
  selectedId: string | "all";
  onChange: (id: string | "all") => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const selectedProp = properties.find((p) => p.id === selectedId);
  const currentLabel = selectedId === "all" ? "All properties" : selectedProp?.name || "Selected property";

  return (
    <div className="property-filter-container" ref={containerRef} style={{ position: "relative" }}>
      <button
        type="button"
        className={`property-filter-trigger ${selectedId !== "all" ? "active" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Filter by property"
      >
        <Building2 size={14} className="filter-icon" />
        <span className="filter-label">{currentLabel}</span>
        <ChevronDown size={13} className="filter-chevron" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="property-filter-popover"
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
          >
            <div className="property-filter-header">
              <span>Filter by location</span>
            </div>

            <div className="property-filter-list">
              <button
                type="button"
                className={`property-filter-item ${selectedId === "all" ? "selected" : ""}`}
                onClick={() => {
                  onChange("all");
                  setIsOpen(false);
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", textAlign: "left" }}>
                  <span className="prop-name">All properties</span>
                  <small className="prop-detail">Global portfolio overview</small>
                </div>
                {selectedId === "all" && <Check size={14} className="prop-check" />}
              </button>

              {properties.map((prop) => (
                <button
                  type="button"
                  key={prop.id}
                  className={`property-filter-item ${selectedId === prop.id ? "selected" : ""}`}
                  onClick={() => {
                    onChange(prop.id);
                    setIsOpen(false);
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", textAlign: "left" }}>
                    <span className="prop-name">{prop.name}</span>
                    <small className="prop-detail">
                      {prop.location} · {prop.total_rooms || 0} rooms
                    </small>
                  </div>
                  {selectedId === prop.id && <Check size={14} className="prop-check" />}
                </button>
              ))}
            </div>

            <div style={{ borderTop: "1px solid var(--line)", padding: "6px 8px", background: "var(--canvas-alt)" }}>
              <a
                href="/dashboard/properties"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "11px",
                  fontWeight: 500,
                  color: "var(--ink)",
                  textDecoration: "none",
                  padding: "6px 8px",
                  borderRadius: "4px",
                }}
              >
                <span>+ Register new property…</span>
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
