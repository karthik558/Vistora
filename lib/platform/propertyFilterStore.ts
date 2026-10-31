"use client";

import { useEffect, useState, useCallback } from "react";

const STORAGE_KEY = "vistora_dashboard_property_filter";
const EVENT_NAME = "vistora-property-filter-change";

export function getStoredPropertyFilter(): string[] {
  if (typeof window === "undefined") return ["all"];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return ["all"];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.length === 0 ? ["all"] : parsed;
    }
    if (typeof parsed === "string") {
      return [parsed];
    }
  } catch {
    /* Fallback to all properties on parsing failure */
  }
  return ["all"];
}

export function setStoredPropertyFilter(val: string[] | string): void {
  if (typeof window === "undefined") return;
  try {
    let normalized: string[];
    if (Array.isArray(val)) {
      normalized = val.length === 0 ? ["all"] : val;
    } else {
      normalized = [val];
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: normalized }));
  } catch {
    /* Retain memory state on storage quota error */
  }
}

export function matchesPropertyFilter(
  propertyId: string | null | undefined,
  filter: string[] | string | "all" | null | undefined
): boolean {
  if (!filter) return true;
  if (filter === "all") return true;
  if (Array.isArray(filter)) {
    if (filter.length === 0 || filter.includes("all")) return true;
    return !!propertyId && filter.includes(propertyId);
  }
  return !!propertyId && propertyId === filter;
}

export function useSharedPropertyFilter() {
  const [selectedIds, setSelectedIdsState] = useState<string[]>(() => {
    return getStoredPropertyFilter();
  });

  useEffect(() => {
    // Synchronize on mount from localStorage
    setSelectedIdsState(getStoredPropertyFilter());

    const handleCustomEvent = (e: Event) => {
      const detail = (e as CustomEvent<string[]>).detail;
      if (Array.isArray(detail)) {
        setSelectedIdsState(detail);
      }
    };

    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setSelectedIdsState(getStoredPropertyFilter());
      }
    };

    window.addEventListener(EVENT_NAME, handleCustomEvent);
    window.addEventListener("storage", handleStorageEvent);
    return () => {
      window.removeEventListener(EVENT_NAME, handleCustomEvent);
      window.removeEventListener("storage", handleStorageEvent);
    };
  }, []);

  const setSelected = useCallback((newVal: string[] | string) => {
    let normalized: string[];
    if (Array.isArray(newVal)) {
      normalized = newVal.length === 0 ? ["all"] : newVal;
    } else {
      normalized = [newVal];
    }
    setSelectedIdsState(normalized);
    setStoredPropertyFilter(normalized);
  }, []);

  const isAll = selectedIds.length === 0 || selectedIds.includes("all");
  const singleSelectedId: string | "all" = isAll
    ? "all"
    : selectedIds.length === 1
    ? selectedIds[0]
    : "all";

  const matches = useCallback(
    (propId: string | null | undefined) => matchesPropertyFilter(propId, selectedIds),
    [selectedIds]
  );

  return {
    selectedIds,
    setSelectedIds: setSelected,
    isAll,
    singleSelectedId,
    matches,
  };
}

