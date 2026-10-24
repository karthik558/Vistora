"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export interface SelectOption {
  value: string;
  label: string;
  detail?: string;
  icon?: React.ReactNode;
}

export interface CustomSelectProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  header?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
  triggerStyle?: React.CSSProperties;
  popoverStyle?: React.CSSProperties;
  className?: string;
}

export default function CustomSelect({
  id,
  value,
  onChange,
  options,
  placeholder = "Select an option",
  header,
  disabled = false,
  style,
  triggerStyle,
  popoverStyle,
  className = "",
}: CustomSelectProps) {
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

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div
      ref={containerRef}
      className={`custom-select-wrapper ${className}`}
      style={{
        position: "relative",
        width: "100%",
        ...style,
      }}
    >
      <button
        id={id}
        type="button"
        disabled={disabled}
        className={`custom-select-trigger ${isOpen ? "open" : ""} ${value ? "has-value" : ""}`}
        onClick={() => {
          if (!disabled) setIsOpen(!isOpen);
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
          padding: "9px 12px",
          background: "#ffffff",
          border: isOpen ? "1px solid #637f6b" : "1px solid var(--line)",
          borderRadius: "6px",
          color: selectedOption ? "var(--ink)" : "var(--muted)",
          fontSize: "12px",
          fontFamily: "var(--font-dm-sans)",
          fontWeight: selectedOption ? 500 : 400,
          cursor: disabled ? "not-allowed" : "pointer",
          boxShadow: isOpen ? "0 0 0 2px rgba(99, 127, 107, 0.12)" : "var(--shadow-xs)",
          transition: "all 0.15s ease",
          textAlign: "left",
          outline: "none",
          opacity: disabled ? 0.6 : 1,
          ...triggerStyle,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selectedOption?.icon && (
            <span style={{ display: "inline-flex", color: "#647368", flexShrink: 0 }}>
              {selectedOption.icon}
            </span>
          )}
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>

        <ChevronDown
          size={13}
          style={{
            flexShrink: 0,
            color: "#647368",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.16s ease",
          }}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="custom-select-popover"
            initial={{ opacity: 0, y: 4, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.99 }}
            transition={{ duration: 0.14, ease: "easeOut" }}
            style={{
              position: "absolute",
              top: "calc(100% + 5px)",
              left: 0,
              right: 0,
              zIndex: 1100,
              background: "#ffffff",
              border: "1px solid var(--line)",
              borderRadius: "8px",
              boxShadow: "0 12px 32px rgba(15, 23, 19, 0.14), 0 2px 6px rgba(15, 23, 19, 0.05)",
              maxHeight: "260px",
              overflowY: "auto",
              padding: "6px",
              ...popoverStyle,
            }}
          >
            {header && (
              <div
                style={{
                  fontSize: "10px",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "#88968c",
                  padding: "5px 8px 7px",
                  fontWeight: 600,
                  borderBottom: "1px solid var(--line)",
                  marginBottom: "4px",
                }}
              >
                {header}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              {options.map((option) => {
                const isSelected = option.value === value;
                return (
                  <button
                    key={option.value || "__empty__"}
                    type="button"
                    className={`custom-select-option ${isSelected ? "selected" : ""}`}
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "8px",
                      padding: "8px 10px",
                      background: isSelected ? "#eaf0eb" : "transparent",
                      border: "none",
                      borderRadius: "5px",
                      cursor: "pointer",
                      transition: "background 0.12s ease",
                      width: "100%",
                      textAlign: "left",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = "#f3f6f3";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = "transparent";
                      }
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                      {option.icon && (
                        <span style={{ display: "inline-flex", color: "#647368", flexShrink: 0 }}>
                          {option.icon}
                        </span>
                      )}
                      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                        <span
                          style={{
                            fontSize: "12px",
                            fontWeight: isSelected ? 600 : 500,
                            color: "var(--ink)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {option.label}
                        </span>
                        {option.detail && (
                          <small
                            style={{
                              fontSize: "10px",
                              color: "#7d8b81",
                              marginTop: "1px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {option.detail}
                          </small>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <Check
                        size={14}
                        strokeWidth={2.2}
                        style={{ color: "#254230", flexShrink: 0 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
