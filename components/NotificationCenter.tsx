"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Bell, Check, Clock, AlertTriangle, MessageSquare, Send, ExternalLink, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  getReadNotificationIds,
  markAllNotificationsAsRead,
  markNotificationIdsAsRead,
  markComplaintsAsRead,
} from "../lib/platform/notificationsStore";

export interface SystemNotification {
  id: string;
  title: string;
  message: string;
  type: "feedback" | "complaint" | "sla" | "invitation";
  time: string;
  href: string;
  read: boolean;
}

export default function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const popoverRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    let active = true;

    async function fetchLiveNotifications() {
      try {
        setLoading(true);
        const readIds = getReadNotificationIds();

        // Fetch live feedback records
        const feedbackRes = await fetch("/api/feedback");
        const feedbackJson = await feedbackRes.json();
        const feedbackList: any[] = Array.isArray(feedbackJson?.data) ? feedbackJson.data : [];

        // Fetch live audit logs if available
        let auditList: any[] = [];
        try {
          const auditRes = await fetch("/api/audit-log");
          const auditJson = await auditRes.json();
          if (auditJson?.success && Array.isArray(auditJson?.data)) {
            auditList = auditJson.data;
          }
        } catch {}

        const realList: SystemNotification[] = [];

        // Sort real feedback latest first
        const sortedFeedback = [...feedbackList].sort(
          (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        );

        for (const item of sortedFeedback.slice(0, 8)) {
          const notifId = `fb-${item.id}`;
          const isComplaint = item.rating <= 2 || item.status === "needs_attention" || item.status === "escalated";
          const isSla = item.status === "needs_attention" || item.status === "escalated";

          let title = "";
          let message = "";
          let type: SystemNotification["type"] = "feedback";
          let href = "/dashboard/feedback";

          if (isComplaint) {
            type = isSla ? "sla" : "complaint";
            title = item.status === "escalated"
              ? `Escalated: ${item.department || "Guest Recovery"}`
              : item.rating <= 2
              ? `Service Recovery Alert (${item.rating}★)`
              : `Needs Attention: ${item.department || "Hospitality"}`;
            message = `${item.name || "Guest"}${item.roomNumber ? ` (Room ${item.roomNumber})` : ""}: ${item.comment ? (item.comment.length > 70 ? item.comment.slice(0, 70) + "…" : item.comment) : "Guest submitted service request requiring review."}`;
            href = "/dashboard/complaints";
          } else if (item.rating >= 4) {
            type = "feedback";
            title = `New ${item.rating}-Star Review`;
            message = `${item.name || "Guest"}${item.roomNumber ? ` (Room ${item.roomNumber})` : ""} submitted a ${item.rating}★ review for ${item.department || "the hotel"}.`;
            href = "/dashboard/feedback";
          } else {
            type = "feedback";
            title = `Guest Rating Received (${item.rating}★)`;
            message = `${item.name || "Guest"}${item.roomNumber ? ` (Room ${item.roomNumber})` : ""} rated ${item.department || "Services"} ${item.rating}★.`;
            href = "/dashboard/feedback";
          }

          realList.push({
            id: notifId,
            title,
            message,
            type,
            time: item.timeAgo || "Recently",
            href,
            read: readIds.includes(notifId),
          });
        }

        // Add real audit log actions if any
        for (const log of auditList.slice(0, 3)) {
          const notifId = `audit-${log.id}`;
          const actor = log.actor_name || log.actor_email || "Staff member";
          realList.push({
            id: notifId,
            title: log.action || "Compliance Event",
            message: `${actor} recorded a compliance audit action${log.target_user ? ` on ${log.target_user}` : ""}.`,
            type: "invitation",
            time: new Date(log.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            href: "/dashboard/audit-log",
            read: readIds.includes(notifId),
          });
        }

        if (active) {
          setNotifications(realList);
        }
      } catch (err) {
        console.error("Failed to load notifications:", err);
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchLiveNotifications();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
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

  useEffect(() => {
    const handleSync = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      const readIds = getReadNotificationIds();
      setNotifications((prev) =>
        prev.map((n) => {
          if (readIds.includes(n.id)) return { ...n, read: true };
          if (detail?.type === "mark_all_read") return { ...n, read: true };
          if (
            detail?.type === "complaints_read" &&
            (n.type === "complaint" || n.type === "sla" || n.href.includes("/complaints"))
          ) {
            return { ...n, read: true };
          }
          return n;
        })
      );
    };
    window.addEventListener("vistora-notifications-change", handleSync);
    window.addEventListener("storage", handleSync);
    return () => {
      window.removeEventListener("vistora-notifications-change", handleSync);
      window.removeEventListener("storage", handleSync);
    };
  }, []);

  const markAllRead = () => {
    const allIds = notifications.map((n) => n.id);
    markAllNotificationsAsRead(allIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markItemRead = (id: string, type?: string) => {
    markNotificationIdsAsRead([id]);
    if (type === "complaint" || type === "sla") {
      markComplaintsAsRead();
    }
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  return (
    <div className="notification-center-wrap" ref={popoverRef} style={{ position: "relative" }}>
      <button
        type="button"
        className="topbar-icon-btn notification-bell-btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="System Notifications"
        title="View Notifications"
      >
        <Bell size={17} strokeWidth={1.8} />
        {unreadCount > 0 && (
          <span className="notification-badge-count">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="notification-popover"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
          >
            {/* Header */}
            <div className="notification-header">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <strong className="notification-header-title">System Notifications</strong>
                {unreadCount > 0 && (
                  <span className="notification-header-badge">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllRead}
                    className="notification-mark-all-btn"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="notification-close-btn"
                  aria-label="Close notifications"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Notification items */}
            <div className="notification-list">
              {loading ? (
                <div className="notification-empty">Loading live notifications…</div>
              ) : notifications.length === 0 ? (
                <div className="notification-empty">All caught up! No recent notifications.</div>
              ) : (
                notifications.map((item) => {
                  const isUnread = !item.read;
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={() => {
                        markItemRead(item.id, item.type);
                        setIsOpen(false);
                      }}
                      className={`notification-item ${isUnread ? "unread" : "read"}`}
                    >
                      <div className={`notification-icon-pill ${item.type}`}>
                        {item.type === "sla" ? (
                          <AlertTriangle size={15} />
                        ) : item.type === "invitation" ? (
                          <Send size={14} />
                        ) : (
                          <MessageSquare size={14} />
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "3px" }}>
                          <strong className="notification-item-title">{item.title}</strong>
                          <span className="notification-item-time">{item.time}</span>
                        </div>
                        <p className="notification-item-message">{item.message}</p>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="notification-footer">
              <span>Hospitality Real-Time Dispatch</span>
              <Link
                href="/dashboard/complaints"
                onClick={() => {
                  markComplaintsAsRead();
                  setIsOpen(false);
                }}
                className="notification-footer-link"
              >
                <span>View Complaints &amp; SLA</span>
                <ExternalLink size={11} />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
