"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useId, useRef } from "react";

export function ConfirmDrawer({
  open,
  title,
  recordName,
  consequence,
  confirmLabel = "Delete permanently",
  pending = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  recordName: string;
  consequence: string;
  confirmLabel?: string;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const drawerRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancelRef.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="drawer-backdrop confirm-drawer-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          onClick={() => { if (!pending) onCancel(); }}
        >
          <motion.div
            className="detail-drawer confirm-drawer"
            ref={drawerRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            aria-busy={pending}
            onKeyDown={event => {
              if (event.key === "Escape") {
                event.stopPropagation();
                if (!pending) onCancel();
              }
              if (event.key === "Tab") {
                const items = drawerRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
                if (!items?.length) { event.preventDefault(); drawerRef.current?.focus(); return; }
                const first = items[0], last = items[items.length - 1];
                if (event.shiftKey && (document.activeElement === first || document.activeElement === drawerRef.current)) { event.preventDefault(); last.focus(); }
                else if (!event.shiftKey && (document.activeElement === last || document.activeElement === drawerRef.current)) { event.preventDefault(); first.focus(); }
              }
            }}
            initial={{ x: "100%", opacity: 0.85 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0.85 }}
            transition={{ type: "spring", damping: 30, stiffness: 300, mass: 0.8 }}
            onClick={(event) => event.stopPropagation()}
          >
            <p className="eyebrow">Irreversible action</p>
            <h2 id={titleId}>{title}</h2>
            <p className="confirm-record">{recordName}</p>
            <p id={descriptionId} className="confirm-consequence">{consequence}</p>
            <div className="confirm-actions">
              <button ref={cancelRef} type="button" className="button button-outline" onClick={onCancel} disabled={pending}>
                Cancel
              </button>
              <button type="button" className="button button-danger" onClick={onConfirm} disabled={pending}>
                {pending ? "Deleting…" : confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
