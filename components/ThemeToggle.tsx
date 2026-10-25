"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const current = document.documentElement.getAttribute("data-theme") as "light" | "dark";
    if (current === "dark" || current === "light") {
      setTheme(current);
    } else {
      const saved = localStorage.getItem("vistora-theme") as "light" | "dark";
      if (saved === "dark" || saved === "light") {
        setTheme(saved);
        document.documentElement.setAttribute("data-theme", saved);
      } else {
        setTheme("light");
        document.documentElement.setAttribute("data-theme", "light");
      }
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
    try {
      localStorage.setItem("vistora-theme", nextTheme);
    } catch {}
  };

  if (!mounted) {
    return (
      <div
        style={{
          width: "36px",
          height: "36px",
          borderRadius: "8px",
          border: "1px solid var(--line)",
          background: "var(--panel)",
        }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="topbar-icon-btn theme-toggle-btn"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      style={{
        width: "36px",
        height: "36px",
        borderRadius: "8px",
        border: "1px solid var(--line)",
        background: "var(--panel)",
        color: "var(--ink)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        transition: "all var(--transition-fast)",
      }}
    >
      {theme === "dark" ? (
        <Sun size={17} strokeWidth={1.8} style={{ color: "var(--warm)" }} />
      ) : (
        <Moon size={17} strokeWidth={1.8} style={{ color: "var(--ink)" }} />
      )}
    </button>
  );
}
