"use client";

import { useEffect, useState, useCallback } from "react";

const STORAGE_KEY = "vistora_dashboard_property_filter";
const EVENT_NAME = "vistora-property-filter-change";

/**
 * Resolves the client user's allowed property constraints from stored session if available.
 * Returns null if user is a global super admin or no user session is found.
 */
export function getClientUserAllowedIds(): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("vistora-user");
    if (raw) {
      const user = JSON.parse(raw);
      const isSuperAdmin =
        user.isOrganizationAdmin === true ||
        user.role === "super_admin" ||
        user.orgRole === "super_admin";
      if (isSuperAdmin) return null;
      const ids: string[] =
        Array.isArray(user.propertyIds) && user.propertyIds.length > 0
          ? user.propertyIds
          : user.propertyId
          ? [user.propertyId]
          : [];
      return ids;
    }
  } catch {}
  return null;
}

/**
 * Sanitizes a property filter array against an authorized list of properties.
 * - If allowedPropertyIds is null (Super Admin): permits "all" and any property IDs.
 * - If allowedPropertyIds has length === 1: STRICTLY returns [allowedPropertyIds[0]] (never "all").
 * - If allowedPropertyIds has length > 1: permits selecting "all" (assigned) or valid subsets of allowedPropertyIds.
 */
export function sanitizePropertyFilter(
  current: string[],
  allowedPropertyIds?: string[] | null
): string[] {
  const normalizedAllowed =
    Array.isArray(allowedPropertyIds) || allowedPropertyIds === null
      ? allowedPropertyIds
      : undefined;
  const allowed =
    normalizedAllowed !== undefined ? normalizedAllowed : getClientUserAllowedIds();
  if (allowed === null) {
    return current.length === 0 ? ["all"] : current;
  }
  if (!Array.isArray(allowed) || allowed.length === 0) {
    return current;
  }
  if (allowed.length === 1) {
    return [allowed[0]];
  }
  // Multiple properties assigned:
  if (current.includes("all") || current.length === 0) {
    return ["all"];
  }
  const valid = current.filter((id) => id !== "all" && allowed.includes(id));
  return valid.length > 0 ? valid : ["all"];
}

export function getStoredPropertyFilter(allowedPropertyIds?: string[] | null): string[] {
  if (typeof window === "undefined") return ["all"];
  let parsedFilter: string[] = ["all"];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsedFilter = parsed.length === 0 ? ["all"] : parsed;
      } else if (typeof parsed === "string") {
        parsedFilter = [parsed];
      }
    }
  } catch {
    /* Fallback to all properties on parsing failure */
  }
  return sanitizePropertyFilter(parsedFilter, allowedPropertyIds);
}

export function setStoredPropertyFilter(
  val: string[] | string,
  allowedPropertyIds?: string[] | null
): void {
  if (typeof window === "undefined") return;
  try {
    let normalized: string[];
    if (Array.isArray(val)) {
      normalized = val.length === 0 ? ["all"] : val;
    } else {
      normalized = [val];
    }
    const sanitized = sanitizePropertyFilter(normalized, allowedPropertyIds);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: sanitized }));
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

export function useSharedPropertyFilter(allowedPropertyIds?: string[] | null) {
  const normalizedAllowed =
    Array.isArray(allowedPropertyIds) || allowedPropertyIds === null
      ? allowedPropertyIds
      : undefined;
  const allowedKey = Array.isArray(normalizedAllowed) ? normalizedAllowed.join(",") : null;

  const [selectedIds, setSelectedIdsState] = useState<string[]>(["all"]);

  useEffect(() => {
    // Synchronize on mount from localStorage with allowed properties constraint
    const initial = getStoredPropertyFilter(normalizedAllowed);
    setSelectedIdsState(initial);
    // If the raw storage differed from the sanitized value (e.g. stale "all" or old property), persist the sanitized value
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (JSON.stringify(parsed) !== JSON.stringify(initial)) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
        }
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      }
    } catch {}

    const handleCustomEvent = (e: Event) => {
      const detail = (e as CustomEvent<string[]>).detail;
      if (Array.isArray(detail)) {
        setSelectedIdsState(sanitizePropertyFilter(detail, normalizedAllowed));
      }
    };

    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setSelectedIdsState(getStoredPropertyFilter(normalizedAllowed));
      }
    };

    window.addEventListener(EVENT_NAME, handleCustomEvent);
    window.addEventListener("storage", handleStorageEvent);
    return () => {
      window.removeEventListener(EVENT_NAME, handleCustomEvent);
      window.removeEventListener("storage", handleStorageEvent);
    };
  }, [allowedKey]);

  const setSelected = useCallback(
    (newVal: string[] | string) => {
      let normalized: string[];
      if (Array.isArray(newVal)) {
        normalized = newVal.length === 0 ? ["all"] : newVal;
      } else {
        normalized = [newVal];
      }
      const sanitized = sanitizePropertyFilter(normalized, normalizedAllowed);
      setSelectedIdsState(sanitized);
      setStoredPropertyFilter(sanitized, normalizedAllowed);
    },
    [allowedKey]
  );

  const effectiveAllowed =
    normalizedAllowed !== undefined ? normalizedAllowed : getClientUserAllowedIds();
  const isSingleProperty = Array.isArray(effectiveAllowed) && effectiveAllowed.length === 1;

  const isAll = isSingleProperty
    ? false
    : selectedIds.length === 0 || selectedIds.includes("all");
  const singleSelectedId: string | "all" = isSingleProperty
    ? effectiveAllowed ? effectiveAllowed[0] : (selectedIds[0] || "all")
    : isAll
    ? "all"
    : selectedIds.length === 1
    ? selectedIds[0]
    : "all";

  const matches = useCallback(
    (propId: string | null | undefined) =>
      matchesPropertyFilter(
        propId,
        isSingleProperty && effectiveAllowed ? [effectiveAllowed[0]] : selectedIds
      ),
    [selectedIds, isSingleProperty, allowedKey]
  );

  return {
    selectedIds: isSingleProperty && effectiveAllowed ? [effectiveAllowed[0]] : selectedIds,
    setSelectedIds: setSelected,
    isAll,
    singleSelectedId,
    matches,
    isSingleProperty,
  };
}
