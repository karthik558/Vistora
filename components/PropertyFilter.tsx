"use client";

import { useState, useRef, useEffect } from "react";
import { Building2, ChevronDown, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { PropertyRow } from "../types/experience";

export interface PropertyFilterProps {
  properties: (Pick<PropertyRow, "id" | "name"> & Partial<Pick<PropertyRow, "location" | "total_rooms">>)[];
  selectedId?: string | "all";
  selectedIds?: string[];
  onChange: (id: string | "all", selectedIds?: string[]) => void;
  manageHref?: string;
}

export default function PropertyFilter({
  properties,
  selectedId,
  selectedIds,
  onChange,
  manageHref = "/dashboard/properties",
}: PropertyFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Normalize selected IDs
  const activeIds: string[] = selectedIds !== undefined
    ? (selectedIds.length === 0 ? ["all"] : selectedIds)
    : selectedId !== undefined
    ? [selectedId]
    : ["all"];

  const isAll = activeIds.length === 0 || activeIds.includes("all");

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
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

  // Label calculation
  let currentLabel = "All properties";
  let countBadge = 0;

  if (!isAll) {
    if (activeIds.length === 1) {
      const match = properties.find((p) => p.id === activeIds[0]);
      currentLabel = match?.name || "Selected property";
    } else if (activeIds.length > 1) {
      if (activeIds.length === properties.length) {
        currentLabel = "All properties";
      } else {
        const firstMatch = properties.find((p) => p.id === activeIds[0]);
        currentLabel = firstMatch
          ? `${firstMatch.name} +${activeIds.length - 1}`
          : `${activeIds.length} properties selected`;
        countBadge = activeIds.length;
      }
    }
  }

  function handleSelectAll() {
    onChange("all", ["all"]);
  }

  function handleToggleProperty(propId: string) {
    if (isAll) {
      // Transitioning from "all" to selecting just this one
      onChange(propId, [propId]);
      return;
    }

    let next: string[];
    if (activeIds.includes(propId)) {
      next = activeIds.filter((id) => id !== propId);
      if (next.length === 0) next = ["all"];
    } else {
      next = [...activeIds.filter((id) => id !== "all"), propId];
      if (next.length === properties.length) {
        next = ["all"];
      }
    }

    const primary = next.includes("all") ? "all" : next[0] || "all";
    onChange(primary, next);
  }

  function handleSelectOnly(e: React.MouseEvent, propId: string) {
    e.stopPropagation();
    onChange(propId, [propId]);
  }

  return (
    <div className="property-filter-container" ref={containerRef} style={{ position: "relative" }}>
      <button
        type="button"
        className={`property-filter-trigger ${!isAll ? "active" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Filter by property"
        aria-expanded={isOpen}
      >
        <Building2 size={14} className="filter-icon" />
        <span className="filter-label">{currentLabel}</span>
        {countBadge > 0 && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "10px",
              fontWeight: 700,
              padding: "1px 6px",
              borderRadius: "999px",
              background: "var(--sage, #4e6f5b)",
              color: "#ffffff",
              marginLeft: "4px",
            }}
          >
            {countBadge}
          </span>
        )}
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
            <div className="property-filter-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Filter by location</span>
              {!isAll && (
                <button
                  type="button"
                  onClick={handleSelectAll}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--sage, #4e6f5b)",
                    fontSize: "10px",
                    fontWeight: 600,
                    cursor: "pointer",
                    padding: "0",
                  }}
                >
                  Reset to all
                </button>
              )}
            </div>

            <div className="property-filter-list">
              {/* All properties option */}
              <button
                type="button"
                className={`property-filter-item ${isAll ? "selected" : ""}`}
                onClick={handleSelectAll}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span
                    style={{
                      width: "14px",
                      height: "14px",
                      border: "1px solid var(--line-strong)",
                      borderRadius: "3px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: isAll ? "var(--sage, #4e6f5b)" : "transparent",
                      color: "#fff",
                    }}
                  >
                    {isAll && <Check size={11} strokeWidth={3} />}
                  </span>
                  <div style={{ display: "flex", flexDirection: "column", textAlign: "left" }}>
                    <span className="prop-name">All properties</span>
                    <small className="prop-detail">Global portfolio overview</small>
                  </div>
                </div>
              </button>

              {/* Individual properties with multi-select */}
              {properties.map((prop) => {
                const isSelected = !isAll && activeIds.includes(prop.id);
                return (
                  <div
                    key={prop.id}
                    className={`property-filter-item ${isSelected ? "selected" : ""}`}
                    onClick={() => handleToggleProperty(prop.id)}
                    style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, minWidth: 0 }}>
                      <span
                        style={{
                          width: "14px",
                          height: "14px",
                          border: "1px solid var(--line-strong)",
                          borderRadius: "3px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: isSelected ? "var(--sage, #4e6f5b)" : "transparent",
                          color: "#fff",
                          flexShrink: 0,
                        }}
                      >
                        {isSelected && <Check size={11} strokeWidth={3} />}
                      </span>
                      <div style={{ display: "flex", flexDirection: "column", textAlign: "left", minWidth: 0 }}>
                        <span className="prop-name" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {prop.name}
                        </span>
                        {(prop.location || prop.total_rooms != null) && (
                          <small className="prop-detail">
                            {[prop.location, prop.total_rooms != null ? `${prop.total_rooms} rooms` : null]
                              .filter(Boolean)
                              .join(" · ")}
                          </small>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleSelectOnly(e, prop.id)}
                      title="Isolate this property only"
                      style={{
                        background: "var(--canvas-alt)",
                        border: "1px solid var(--line)",
                        color: "var(--muted)",
                        fontSize: "9px",
                        fontWeight: 600,
                        padding: "2px 6px",
                        borderRadius: "3px",
                        cursor: "pointer",
                        marginLeft: "6px",
                        flexShrink: 0,
                      }}
                    >
                      Only
                    </button>
                  </div>
                );
              })}
            </div>

            <div style={{ borderTop: "1px solid var(--line)", padding: "6px 8px", background: "var(--canvas-alt)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "10px", color: "var(--muted)" }}>
                {isAll ? "Showing all properties" : `${activeIds.length} of ${properties.length} active`}
              </span>
              <a
                href={manageHref}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  fontSize: "11px",
                  fontWeight: 500,
                  color: "var(--ink)",
                  textDecoration: "none",
                  padding: "4px 6px",
                  borderRadius: "4px",
                }}
              >
                <span>+ Register…</span>
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
