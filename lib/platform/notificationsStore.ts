"use client";

import { useEffect, useState, useCallback } from "react";

const NOTIFICATIONS_STORAGE_KEY = "vistora_read_notifications";
const COMPLAINTS_ACK_STORAGE_KEY = "vistora_complaints_acknowledged";
const EVENT_NAME = "vistora-notifications-change";

export function getReadNotificationIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function isComplaintsAcknowledged(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(COMPLAINTS_ACK_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function setComplaintsAcknowledged(acknowledged: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (acknowledged) {
      localStorage.setItem(COMPLAINTS_ACK_STORAGE_KEY, "true");
    } else {
      localStorage.removeItem(COMPLAINTS_ACK_STORAGE_KEY);
    }
    window.dispatchEvent(
      new CustomEvent(EVENT_NAME, { detail: { type: "complaints_ack", acknowledged } })
    );
  } catch {}
}

export function markNotificationIdsAsRead(ids: string[]): void {
  if (typeof window === "undefined" || !ids.length) return;
  try {
    const current = getReadNotificationIds();
    const set = new Set([...current, ...ids]);
    const updated = Array.from(set);
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(
      new CustomEvent(EVENT_NAME, { detail: { type: "read_ids", ids: updated } })
    );
  } catch {}
}

export function markAllNotificationsAsRead(allIds?: string[]): void {
  if (typeof window === "undefined") return;
  try {
    const current = getReadNotificationIds();
    const combined =
      allIds && allIds.length ? Array.from(new Set([...current, ...allIds])) : current;
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(combined));
    localStorage.setItem(COMPLAINTS_ACK_STORAGE_KEY, "true");
    window.dispatchEvent(
      new CustomEvent(EVENT_NAME, { detail: { type: "mark_all_read", ids: combined } })
    );
  } catch {}
}

export function markComplaintsAsRead(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(COMPLAINTS_ACK_STORAGE_KEY, "true");
    window.dispatchEvent(
      new CustomEvent(EVENT_NAME, { detail: { type: "complaints_read" } })
    );
  } catch {}
}

export function computeComplaintBadgeCount(hasUnresolved: boolean | number): number {
  if (typeof window === "undefined") return 0;
  if (isComplaintsAcknowledged()) return 0;
  const num = typeof hasUnresolved === "number" ? hasUnresolved : hasUnresolved ? 1 : 0;
  if (num <= 0) return 0;
  // User requirement: "It should only show the latest updated one."
  return 1;
}

export function useComplaintBadge(rawComplaintsCount: number = 0) {
  const [badgeCount, setBadgeCount] = useState<number>(() => {
    return computeComplaintBadgeCount(rawComplaintsCount);
  });

  useEffect(() => {
    setBadgeCount(computeComplaintBadgeCount(rawComplaintsCount));

    const handleUpdate = () => {
      setBadgeCount(computeComplaintBadgeCount(rawComplaintsCount));
    };

    window.addEventListener(EVENT_NAME, handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener(EVENT_NAME, handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, [rawComplaintsCount]);

  const clearBadge = useCallback(() => {
    markComplaintsAsRead();
    setBadgeCount(0);
  }, []);

  return { badgeCount, clearBadge };
}

