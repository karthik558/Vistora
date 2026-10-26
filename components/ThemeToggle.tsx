"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const syncTheme = () => setTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const syncStorage = (event: StorageEvent) => {
      if (event.key !== "vistora-theme") return;
      document.documentElement.setAttribute("data-theme", event.newValue === "dark" ? "dark" : "light");
    };
    window.addEventListener("storage", syncStorage);
    return () => {
      observer.disconnect();
      window.removeEventListener("storage", syncStorage);
    };
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
      aria-pressed={theme === "dark"}
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
        <Sun size={17} strokeWidth={1.8} />
      ) : (
        <Moon size={17} strokeWidth={1.8} style={{ color: "var(--ink)" }} />
      )}
    </button>
  );
}
