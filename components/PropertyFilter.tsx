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
  isGlobalAdmin?: boolean;
}

export default function PropertyFilter({
  properties,
  selectedId,
  selectedIds,
  onChange,
  manageHref = "/dashboard/properties",
  isGlobalAdmin = true,
}: PropertyFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});
  useEffect(() => {
    if (!isOpen) return;
    const place = () => {
      const trigger = containerRef.current;
      if (!trigger) return;
      const anchor = trigger.getBoundingClientRect();
      const container = trigger.closest(".platform-card, .panel, .content-wrap");
      const boundary = container?.getBoundingClientRect();
      const padding = container ? window.getComputedStyle(container) : null;
      const leftEdge = Math.max(8, (boundary?.left ?? 0) + (parseFloat(padding?.paddingLeft || "0") || 0) + 8);
      const rightEdge = Math.min(window.innerWidth - 8, (boundary?.right ?? window.innerWidth) - (parseFloat(padding?.paddingRight || "0") || 0) - 8);
      const width = Math.min(300, Math.max(0, rightEdge - leftEdge));
      const left = Math.max(leftEdge, Math.min(anchor.left, rightEdge - width));
      setPopoverStyle({ left: left - anchor.left, right: "auto", width, minWidth: 0, maxWidth: width });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [isOpen]);

  // Normalize selected IDs
  const activeIds: string[] = selectedIds !== undefined
    ? (selectedIds.length === 0 ? ["all"] : selectedIds)
    : selectedId !== undefined
    ? [selectedId]
    : ["all"];

  const isSingle = properties.length === 1;
  const isAll = isSingle ? false : (activeIds.length === 0 || activeIds.includes("all"));

  // Automatic synchronization for single property accounts:
  // If user only has access to exactly one property, ensure the selection is locked to that property ID.
  useEffect(() => {
    if (isSingle && properties[0]?.id) {
      const singleId = properties[0].id;
      if (activeIds.length !== 1 || activeIds[0] !== singleId) {
        onChange(singleId, [singleId]);
      }
    }
  }, [isSingle, properties, activeIds, onChange]);

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
  let currentLabel = isGlobalAdmin ? "All properties" : "All assigned properties";
  let countBadge = 0;

  if (isSingle) {
    currentLabel = properties[0]?.name || "Assigned property";
  } else if (properties.length > 1) {
    if (isAll) {
      currentLabel = isGlobalAdmin ? "All properties" : "All assigned properties";
    } else if (activeIds.length === 1) {
      const match = properties.find((p) => p.id === activeIds[0]);
      currentLabel = match?.name || "Selected property";
    } else if (activeIds.length > 1) {
      if (activeIds.length === properties.length) {
        currentLabel = isGlobalAdmin ? "All properties" : "All assigned properties";
      } else {
        const firstMatch = properties.find((p) => p.id === activeIds[0]);
        currentLabel = firstMatch
          ? `${firstMatch.name} +${activeIds.length - 1}`
          : `${activeIds.length} properties selected`;
        countBadge = activeIds.length;
      }
    }
  } else if (properties.length === 0) {
    if (selectedId && selectedId !== "all") {
      currentLabel = "Selected property";
    } else {
      currentLabel = isGlobalAdmin ? "All properties" : "Assigned property";
    }
  }

  function handleSelectAll() {
    onChange("all", ["all"]);
    setIsOpen(false);
  }

  function handleSelectProperty(propId: string) {
    if (isSingle) return;
    onChange(propId, [propId]);
    setIsOpen(false);
  }

  function handleToggleCheckbox(e: React.MouseEvent, propId: string) {
    e.stopPropagation();
    if (isSingle) return; // Cannot toggle away from the only assigned property

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

  return (
    <div className="property-filter-container" ref={containerRef} style={{ position: "relative" }}>
      <button
        type="button"
        className={`property-filter-trigger ${!isAll || isSingle ? "active" : ""}`}
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
            style={popoverStyle}
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
          >
            <div className="property-filter-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>
                {isSingle
                  ? "Assigned property"
                  : isGlobalAdmin
                  ? "Filter by location"
                  : "Filter by assigned property"}
              </span>
              {!isAll && properties.length > 1 && (
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
                  Reset to {isGlobalAdmin ? "all" : "all assigned"}
                </button>
              )}
            </div>

            <div className="property-filter-list">
              {/* All properties / All assigned properties option - only rendered when more than 1 property exists */}
              {properties.length > 1 && (
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
                      <span className="prop-name">
                        {isGlobalAdmin ? "All properties" : "All assigned properties"}
                      </span>
                      <small className="prop-detail">
                        {isGlobalAdmin
                          ? "Global portfolio overview"
                          : `All ${properties.length} properties assigned to your account`}
                      </small>
                    </div>
                  </div>
                </button>
              )}

              {/* Individual properties */}
              {properties.map((prop) => {
                const isSelected = isSingle || (!isAll && activeIds.includes(prop.id));
                return (
                  <div
                    key={prop.id}
                    className={`property-filter-item ${isSelected ? "selected" : ""}`}
                    onClick={() => handleSelectProperty(prop.id)}
                    style={{
                      cursor: isSingle ? "default" : "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, minWidth: 0 }}>
                      <span
                        onClick={(e) => handleToggleCheckbox(e, prop.id)}
                        title="Toggle selection"
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
                          cursor: isSingle ? "default" : "pointer",
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

                    {isSingle ? (
                      <span
                        style={{
                          background: "rgba(78, 111, 91, 0.1)",
                          color: "var(--sage, #4e6f5b)",
                          fontSize: "9px",
                          fontWeight: 700,
                          padding: "2px 7px",
                          borderRadius: "4px",
                          marginLeft: "6px",
                          flexShrink: 0,
                        }}
                      >
                        Assigned
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div style={{ borderTop: "1px solid var(--line)", padding: "6px 8px", background: "var(--canvas-alt)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "10px", color: "var(--muted)" }}>
                {isSingle
                  ? "Assigned to this property"
                  : isAll
                  ? isGlobalAdmin
                    ? "Showing all properties"
                    : `Showing all ${properties.length} assigned properties`
                  : `${activeIds.length} of ${properties.length} active`}
              </span>
              {isGlobalAdmin && (
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
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
