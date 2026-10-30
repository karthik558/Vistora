"use client";

import React, { useState, useRef, useEffect, useId } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";
import { motion } from "framer-motion";

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
  floating?: boolean;
  ariaLabel?: string;
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
  floating = false,
  ariaLabel,
  style,
  triggerStyle,
  popoverStyle,
  className = "",
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [floatingStyle, setFloatingStyle] = useState<React.CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const [activeIndex, setActiveIndex] = useState(0);
  const searchRef = useRef({ text: "", time: 0 });

  function openMenu(index = Math.max(0, options.findIndex(option => option.value === value))) {
    setActiveIndex(index);
    setIsOpen(true);
  }

  useEffect(() => {
    if (isOpen) menuRef.current?.querySelectorAll<HTMLElement>('[role="option"]')[activeIndex]?.focus();
  }, [isOpen, activeIndex]);

  useEffect(() => {
    if (!isOpen || !floating) return;
    function place() {
      const node = containerRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const shell=node.closest(".app-shell");
      const accents:Record<string,string>={};
      if(shell){const theme=getComputedStyle(shell);for(const key of ["--sage","--sage-deep","--sage-soft","--sage-hover","--module-accent"])accents[key]=theme.getPropertyValue(key);}
      const width = Math.min(Math.max(rect.width, 196),window.innerWidth-16);
      const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
      const openUp = window.innerHeight - rect.bottom < 220;
      setFloatingStyle({
        ...accents,
        position: "fixed",
        top: openUp ? "auto" : rect.bottom + 6,
        bottom: openUp ? window.innerHeight - rect.top + 6 : "auto",
        left,
        width,
        right: "auto",
        maxHeight:Math.max(100,Math.min(320,openUp?rect.top-16:window.innerHeight-rect.bottom-16)),
        overflowY:"auto",
        zIndex: 1300,
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

  useEffect(() => {
    function handleKey(event:KeyboardEvent){if(event.key==="Escape"){setIsOpen(false);containerRef.current?.querySelector("button")?.focus();}}
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (containerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setIsOpen(false);
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown",handleKey);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown",handleKey);
    };
  }, [isOpen]);

  useEffect(()=>{if(disabled)setIsOpen(false);},[disabled]);

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div
      ref={containerRef}
      onKeyDown={event=>{
        if (disabled) return;
        if(event.key==="Escape"&&isOpen){event.preventDefault();event.stopPropagation();setIsOpen(false);containerRef.current?.querySelector("button")?.focus();return;}
        if (event.key === "Tab" && isOpen) {
          // Portalled options must return to the trigger's natural tab order.
          containerRef.current?.querySelector("button")?.focus();
          setIsOpen(false);
          return;
        }
        if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
          event.preventDefault();
          if (!options.length) return;
          if (!isOpen) { openMenu(event.key === "End" ? options.length - 1 : undefined); return; }
          setActiveIndex(index => event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length);
        } else if (isOpen && event.key.length === 1 && event.key !== " " && !event.ctrlKey && !event.metaKey && !event.altKey) {
          event.preventDefault();
          const now = Date.now();
          const text = (now - searchRef.current.time < 700 ? searchRef.current.text : "") + event.key.toLowerCase();
          searchRef.current = { text, time: now };
          const index = options.findIndex(option => option.label.toLowerCase().startsWith(text));
          if (index >= 0) setActiveIndex(index);
        }
      }}
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
          if (isOpen) setIsOpen(false); else openMenu();
        }}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
          padding: "9px 12px",
          background: "var(--panel)",
          border: isOpen ? "1px solid var(--sage)" : "1px solid var(--line)",
          borderRadius: "6px",
          color: selectedOption ? "var(--ink)" : "var(--muted)",
          fontSize: "12px",
          fontFamily: "var(--font-dm-sans)",
          fontWeight: selectedOption ? 500 : 400,
          cursor: disabled ? "not-allowed" : "pointer",
          boxShadow: isOpen ? "0 0 0 2px var(--sage-soft)" : "var(--shadow-xs)",
          transition: "all 0.15s ease",
          textAlign: "left",
          opacity: disabled ? 0.6 : 1,
          ...triggerStyle,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selectedOption?.icon && (
            <span style={{ display: "inline-flex", color: "var(--muted)", flexShrink: 0 }}>
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
            color: "var(--muted)",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.16s ease",
          }}
        />
      </button>

      {(() => {
          if (!isOpen) return null;
          const menu = (
          <motion.div
            ref={menuRef}
            className={`custom-select-popover${floating ? " is-floating" : ""}`}
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
              background: "var(--panel)",
              border: "1px solid var(--line-strong)",
              borderRadius: "8px",
              boxShadow: "0 12px 32px rgba(0, 0, 0, 0.2), 0 2px 6px rgba(0, 0, 0, 0.08)",
              maxHeight: "260px",
              overflowY: "auto",
              padding: "6px",
              ...(floating ? floatingStyle : {}),
              ...popoverStyle,
            }}
          >
            {header && (
              <div
                style={{
                  fontSize: "10px",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "var(--muted)",
                  padding: "5px 8px 7px",
                  fontWeight: 600,
                  borderBottom: "1px solid var(--line)",
                  marginBottom: "4px",
                }}
              >
                {header}
              </div>
            )}

            <div id={menuId} role="listbox" aria-label={ariaLabel || header || placeholder} style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              {options.length === 0 && <p className="custom-select-empty">No options available</p>}
              {options.map((option, index) => {
                const isSelected = option.value === value;
                return (
                  <button
                    key={option.value || "__empty__"}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    tabIndex={index === activeIndex ? 0 : -1}
                    className={`custom-select-option ${isSelected ? "selected" : ""}`}
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                      containerRef.current?.querySelector("button")?.focus();
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "8px",
                      padding: "10px 12px",
                      background: isSelected ? "var(--sage-soft)" : "transparent",
                      border: "none",
                      borderRadius: "5px",
                      cursor: "pointer",
                      transition: "background 0.12s ease",
                      width: "100%",
                      textAlign: "left",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = "var(--line)";
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
                        <span style={{ display: "inline-flex", color: "var(--muted)", flexShrink: 0 }}>
                          {option.icon}
                        </span>
                      )}
                      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                        <span
                          style={{
                            fontSize: "12px",
                            fontWeight: isSelected ? 600 : 500,
                            color: "var(--ink)",
                            whiteSpace: "normal",
                            lineHeight: 1.35,
                          }}
                        >
                          {option.label}
                        </span>
                        {option.detail && (
                          <small
                            style={{
                              fontSize: "10px",
                              color: "var(--muted)",
                              marginTop: "2px",
                              whiteSpace: "normal",
                              lineHeight: 1.4,
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
                        style={{ color: "var(--sage)", flexShrink: 0 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
          );
          return floating && typeof document !== "undefined" ? createPortal(menu, containerRef.current?.closest("dialog,[role=dialog]") || document.body) : menu;
        })()}
    </div>
  );
}
