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

const INITIAL_NOTIFICATIONS: SystemNotification[] = [
  {
    id: "notif-1",
    title: "New 5-Star Review Received",
    message: "Lady Caroline Montagu (Suite 408) submitted a 5★ review for Concierge.",
    type: "feedback",
    time: "12 min ago",
    href: "/dashboard/feedback",
    read: false,
  },
  {
    id: "notif-2",
    title: "Urgent SLA Alert",
    message: "Room 204 air conditioning complaint has 14 minutes left within SLA response target.",
    type: "sla",
    time: "24 min ago",
    href: "/dashboard/complaints",
    read: false,
  },
  {
    id: "notif-3",
    title: "Guest Invitation Completed",
    message: "Kenjiro Takahashi submitted feedback through tracked invite link (inv_4b12c6f1).",
    type: "invitation",
    time: "1 hour ago",
    href: "/dashboard/invitations",
    read: false,
  },
  {
    id: "notif-4",
    title: "Daily SLA Compliance Report Ready",
    message: "Yesterday's overall hospitality service recovery SLA closed at 96.4%.",
    type: "feedback",
    time: "3 hours ago",
    href: "/dashboard/reports",
    read: true,
  },
];

export default function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<SystemNotification[]>(INITIAL_NOTIFICATIONS);
  const popoverRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

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
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markItemRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
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
              borderRadius: "10px",
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
                      borderRadius: "10px",
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
              {notifications.length === 0 ? (
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
