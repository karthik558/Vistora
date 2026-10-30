"use client";
import { useEffect, useState } from "react";

// Relative links keep SSR and the first browser render identical. Absolute
// copy/export destinations become available only after hydration.
export function useBrowserOrigin() {
  const [origin, setOrigin] = useState("");
  useEffect(() => { setOrigin(window.location.origin); }, []);
  return origin;
}