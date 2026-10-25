"use client";

import { AnimatePresence, motion } from "framer-motion";

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
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="drawer-backdrop confirm-drawer-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          onClick={onCancel}
        >
          <motion.div
            className="detail-drawer confirm-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-drawer-title"
            initial={{ x: "100%", opacity: 0.85 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0.85 }}
            transition={{ type: "spring", damping: 30, stiffness: 300, mass: 0.8 }}
            onClick={(event) => event.stopPropagation()}
          >
            <p className="eyebrow">Irreversible action</p>
            <h2 id="confirm-drawer-title">{title}</h2>
            <p className="confirm-record">{recordName}</p>
            <p className="confirm-consequence">{consequence}</p>
            <div className="confirm-actions">
              <button type="button" className="button button-outline" onClick={onCancel} disabled={pending}>
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
