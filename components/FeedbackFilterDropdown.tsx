"use client";

import { useState, useRef, useEffect } from "react";
import { Filter, ChevronDown, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export type FeedbackCommentFilter = "all" | "with_comments" | "without_comments";

export default function FeedbackFilterDropdown({
  value,
  onChange,
}: {
  value: FeedbackCommentFilter;
  onChange: (val: FeedbackCommentFilter) => void;
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

  const options: { id: FeedbackCommentFilter; label: string; detail: string }[] = [
    { id: "all", label: "All feedback", detail: "All verified submissions" },
    { id: "with_comments", label: "With comments only", detail: "Reviews containing written guest text" },
    { id: "without_comments", label: "Ratings only", detail: "Submissions without written text" },
  ];

  const current = options.find((o) => o.id === value) || options[0];

  return (
    <div className="custom-dropdown-container" ref={containerRef} style={{ position: "relative" }}>
      <button
        type="button"
        className={`custom-dropdown-trigger ${value !== "all" ? "active" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Filter feedback comments"
      >
        <Filter size={13} className="dropdown-icon" />
        <span className="dropdown-label">{current.label}</span>
        <ChevronDown size={12} className="dropdown-chevron" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="custom-dropdown-popover"
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
          >
            <div className="custom-dropdown-header">
              <span>Filter feedback</span>
            </div>

            <div className="custom-dropdown-list">
              {options.map((option) => (
                <button
                  type="button"
                  key={option.id}
                  className={`custom-dropdown-item ${value === option.id ? "selected" : ""}`}
                  onClick={() => {
                    onChange(option.id);
                    setIsOpen(false);
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", textAlign: "left" }}>
                    <span className="dropdown-item-title">{option.label}</span>
                    <small className="dropdown-item-detail">{option.detail}</small>
                  </div>
                  {value === option.id && <Check size={14} className="dropdown-check" />}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
