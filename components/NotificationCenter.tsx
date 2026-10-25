"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Bell, Check, Clock, AlertTriangle, MessageSquare, Send, ExternalLink, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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
        let readIds: string[] = [];
        try {
          const stored = localStorage.getItem("vistora_read_notifications");
          if (stored) readIds = JSON.parse(stored);
        } catch {}

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

  const markAllRead = () => {
    setNotifications((prev) => {
      const updated = prev.map((n) => ({ ...n, read: true }));
      try {
        localStorage.setItem("vistora_read_notifications", JSON.stringify(updated.map((n) => n.id)));
      } catch {}
      return updated;
    });
  };

  const markItemRead = (id: string) => {
    setNotifications((prev) => {
      const updated = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
      try {
        const readIds = updated.filter((n) => n.read).map((n) => n.id);
        localStorage.setItem("vistora_read_notifications", JSON.stringify(readIds));
      } catch {}
      return updated;
    });
  };

  return (
    <div className="notification-center-wrap" ref={popoverRef} style={{ position: "relative" }}>
      <button
        type="button"
        className="topbar-icon-btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="System Notifications"
        title="View Notifications"
        style={{
          position: "relative",
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
        <Bell size={17} strokeWidth={1.8} />
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: "-3px",
              right: "-3px",
              width: "18px",
              height: "18px",
              background: "var(--red)",
              color: "#ffffff",
              borderRadius: "50%",
              fontSize: "10px",
              fontFamily: "var(--font-dm-mono)",
              fontWeight: 700,
              display: "grid",
              placeItems: "center",
              boxShadow: "0 0 6px rgba(179, 90, 77, 0.4)",
            }}
          >
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
            style={{
              position: "absolute",
              right: 0,
              top: "calc(100% + 8px)",
              width: "380px",
              maxWidth: "calc(100vw - 24px)",
              background: "var(--panel)",
              border: "1px solid var(--line)",
              borderRadius: "6px",
              boxShadow: "var(--shadow-lg)",
              zIndex: 1000,
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 18px",
                borderBottom: "1px solid var(--line)",
                background: "var(--canvas-alt)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <strong style={{ fontSize: "13px", letterSpacing: "-0.01em" }}>System Notifications</strong>
                {unreadCount > 0 && (
                  <span
                    style={{
                      background: "var(--sage-soft)",
                      color: "var(--sage-deep)",
                      padding: "1px 6px",
                      borderRadius: "6px",
                      fontSize: "10px",
                      fontWeight: 600,
                      fontFamily: "var(--font-dm-mono)",
                    }}
                  >
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllRead}
                    style={{
                      fontSize: "11px",
                      color: "var(--muted)",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      padding: "2px 6px",
                      borderRadius: "4px",
                    }}
                  >
                    Mark all read
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  style={{
                    color: "var(--muted)",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    display: "grid",
                    placeItems: "center",
                  }}
                  aria-label="Close"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Notification items */}
            <div style={{ maxHeight: "360px", overflowY: "auto" }}>
              {loading ? (
                <div style={{ padding: "32px 18px", textAlign: "center", color: "var(--muted)", fontSize: "12px" }}>
                  Loading live notifications…
                </div>
              ) : notifications.length === 0 ? (
                <div style={{ padding: "32px 18px", textAlign: "center", color: "var(--muted)", fontSize: "12px" }}>
                  All caught up! No recent notifications.
                </div>
              ) : (
                notifications.map((item) => {
                  const isUnread = !item.read;
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={() => {
                        markItemRead(item.id);
                        setIsOpen(false);
                      }}
                      style={{
                        display: "flex",
                        gap: "12px",
                        padding: "14px 18px",
                        borderBottom: "1px solid var(--line)",
                        textDecoration: "none",
                        color: "inherit",
                        background: isUnread ? "var(--canvas-alt)" : "transparent",
                        transition: "background var(--transition-fast)",
                      }}
                    >
                      <div
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "8px",
                          display: "grid",
                          placeItems: "center",
                          flexShrink: 0,
                          background:
                            item.type === "sla"
                              ? "var(--red-soft)"
                              : item.type === "invitation"
                              ? "var(--warm-soft)"
                              : "var(--sage-soft)",
                          color:
                            item.type === "sla"
                              ? "var(--red)"
                              : item.type === "invitation"
                              ? "var(--warm-deep)"
                              : "var(--sage)",
                        }}
                      >
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
                          <strong style={{ fontSize: "12px", fontWeight: isUnread ? 700 : 600 }}>{item.title}</strong>
                          <span style={{ fontSize: "10px", color: "var(--muted)", fontFamily: "var(--font-dm-mono)" }}>
                            {item.time}
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: "11px", color: "var(--muted)", lineHeight: "1.45" }}>
                          {item.message}
                        </p>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                padding: "10px 18px",
                background: "var(--canvas)",
                borderTop: "1px solid var(--line)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: "11px",
              }}
            >
              <span style={{ color: "var(--muted)" }}>Hospitality Real-Time Dispatch</span>
              <Link
                href="/dashboard/complaints"
                onClick={() => setIsOpen(false)}
                style={{ color: "var(--sage-deep)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px" }}
              >
                <span>View Complaints & SLA</span>
                <ExternalLink size={11} />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
