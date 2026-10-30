"use client";

import { useEffect, useState } from "react";

export default function InitialPreloader() {
  // Keep SSR and the first client render empty. The document-only overlay is
  // mounted after hydration, independently of server-rendered page content.
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    setMounted(true);
    const startedAt = performance.now();
    let scheduled = false;
    let hold: ReturnType<typeof setTimeout> | undefined;
    let removal: ReturnType<typeof setTimeout> | undefined;
    const finish = () => {
      if (scheduled) return;
      scheduled = true;
      const remaining = Math.max(0, 1500 - (performance.now() - startedAt));
      hold = setTimeout(() => {
        setLeaving(true);
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        removal = setTimeout(() => setLoading(false), reducedMotion ? 0 : 300);
      }, remaining);
    };
    window.addEventListener("load", finish, { once: true });
    window.addEventListener("pageshow", finish, { once: true });
    // A stalled image or third-party resource must not block the workspace.
    const fallback = window.setTimeout(finish, 8000);
    if (document.readyState === "complete") finish();
    return () => {
      window.removeEventListener("load", finish);
      window.removeEventListener("pageshow", finish);
      window.clearTimeout(fallback);
      clearTimeout(hold);
      clearTimeout(removal);
    };
  }, []);

  if (!mounted || !loading) return null;
  return (
    <div className={`initial-preloader${leaving ? " is-leaving" : ""}`} role="status" aria-label="Loading Vistora">
      <img className="initial-preloader-logo brand-logo-light" src="/vistora_wordmark_green.webp" alt="Vistora" width={140} height={34} />
      <img className="initial-preloader-logo brand-logo-dark" src="/vistora_wordmark_white.webp" alt="Vistora" width={140} height={34} />
    </div>
  );
}