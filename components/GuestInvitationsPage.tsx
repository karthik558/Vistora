"use client";

import { useEffect, useState, useMemo } from "react";
import QRCode from "qrcode";
import {
  Send,
  Plus,
  Copy,
  Check,
  ExternalLink,
  QrCode,
  Clock,
  CheckCircle2,
  AlertCircle,
  Search,
  Trash2,
  X,
  Mail,
  Smartphone,
  MessageSquare,
  Link as LinkIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { AppShell, WorkspaceUser, getClientUser, fetchLatestSession } from "./Dashboard";
import { PropertyRow } from "../types/experience";
import CustomSelect from "./CustomSelect";
import { GuestInvitation } from "../lib/services/invitationsService";
import { ConfirmDrawer } from "./ConfirmDrawer";
import { TableLoadingRows } from "./TableLoadingRows";

export default function GuestInvitationsPage({
  initialUser,
  properties = [],
}: {
  initialUser?: WorkspaceUser | null;
  properties?: PropertyRow[];
}) {
  const [user, setUser] = useState<WorkspaceUser | null>(
    () => initialUser || (typeof window !== "undefined" ? getClientUser() : null)
  );
  const [invitations, setInvitations] = useState<GuestInvitation[]>([]);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "completed">("all");
  const [selectedPropertyFilter, setSelectedPropertyFilter] = useState<string>("all");

  // Modal states
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [qrModalInvite, setQrModalInvite] = useState<GuestInvitation | null>(null);
  const [qrModalDataUrl, setQrModalDataUrl] = useState<string>("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<GuestInvitation | null>(null);
  const [deletingInvite, setDeletingInvite] = useState(false);

  // Form states
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [propertyId, setPropertyId] = useState(properties[0]?.id || "");
  const [channel, setChannel] = useState<"direct_link" | "email" | "sms" | "whatsapp">("direct_link");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const local = getClientUser();
    if (local && !user) setUser(local);

    fetchLatestSession()
      .then((data) => {
        if (data?.success && data?.user) setUser(data.user);
      })
      .catch(() => {});

    loadInvitations();
  }, []);

  async function loadInvitations() {
    setLoading(true);
    try {
      const res = await fetch("/api/invitations");
      const json = await res.json();
      if(!res.ok)throw new Error(json.error||"Cannot load invitations.");
      if (json.success && json.invitations) {
        setInvitations(json.invitations);
      }
    } catch(e) {setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "https://vistora.app";

  function getInviteUrl(inv: GuestInvitation) {
    const p = properties.find((x) => x.id === inv.propertyId);
    const propParam = p?.code || inv.propertyId;
    return `${origin}/feedback?token=${inv.token}&property=${encodeURIComponent(propParam)}&room=${encodeURIComponent(inv.roomNumber)}&guest=${encodeURIComponent(inv.guestName)}`;
  }

  async function handleCreateInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!guestName.trim() || !roomNumber.trim() || !propertyId) return;

    setSubmitting(true);
    try {
      const p = properties.find((x) => x.id === propertyId);
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestName: guestName.trim(),
          guestEmail: guestEmail.trim() || undefined,
          guestPhone: guestPhone.trim() || undefined,
          propertyId,
          propertyName: p?.name,
          roomNumber: roomNumber.trim(),
          channel,
          notes: notes.trim() || undefined,
        }),
      });

      const json = await res.json();
      if(!res.ok||!json.success)throw new Error(json.error||"Cannot create invitation.");
      if (json.success && json.invitation) {
        setNotice(json.message||"Invitation link created.");setError("");
        setInvitations((prev) => [json.invitation, ...prev]);
        setShowInviteModal(false);
        setGuestName("");
        setGuestEmail("");
        setGuestPhone("");
        setRoomNumber("");
        setNotes("");
      }
    } catch(e){setError((e as Error).message);} finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    setDeletingInvite(true);
    try {
      const r=await fetch(`/api/invitations?id=${pendingDelete.id}`, { method: "DELETE" });
      if(!r.ok){const j=await r.json();throw new Error(j.error||"Could not remove invitation.");}
      setInvitations((prev) => prev.filter((i) => i.id !== pendingDelete.id));
      setPendingDelete(null);
    } catch(e) {setError((e as Error).message);
    } finally {
      setDeletingInvite(false);
    }
  }

  async function openQrModal(inv: GuestInvitation) {
    const link = getInviteUrl(inv);
    const uri = await QRCode.toDataURL(link, { width: 280, margin: 2 });
    setQrModalDataUrl(uri);
    setQrModalInvite(inv);
  }

  const filtered = useMemo(() => {
    return invitations
      .filter((inv) => {
        if (selectedPropertyFilter !== "all" && inv.propertyId !== selectedPropertyFilter) return false;
        if (statusFilter !== "all" && inv.status !== statusFilter) return false;
        if (search) {
          const q = search.toLowerCase();
          return (
            inv.guestName.toLowerCase().includes(q) ||
            inv.roomNumber.toLowerCase().includes(q) ||
            inv.token.toLowerCase().includes(q) ||
            (inv.guestEmail && inv.guestEmail.toLowerCase().includes(q))
          );
        }
        return true;
      });
  }, [invitations, selectedPropertyFilter, statusFilter, search]);

  const total = invitations.length;
  const completedCount = invitations.filter((i) => i.status === "completed").length;
  const pendingCount = invitations.filter((i) => i.status === "pending").length;
  const conversionRate = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  return (
    <AppShell active="Guest invitations" user={user}>
      <div className="content-wrap">
        {error&&<p className="platform-notice" role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
        <div className="page-heading">
          <div>
            <p className="eyebrow">Guest Collection Touchpoints</p>
            <h1>Guest invitations & tracked links</h1>
            <p className="subheading">
              Dispatch unique hash-tracked feedback links. When the guest submits feedback, the record is automatically marked as Completed.
            </p>
          </div>
          <div className="page-heading-actions">
            <button
              type="button"
              className="button button-dark"
              onClick={() => setShowInviteModal(true)}
              style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
            >
              <Plus size={16} />
              <span>Create guest invitation</span>
            </button>
          </div>
        </div>

        {/* Metric Cards */}
        <section className="metric-grid">
          <div className="metric-card">
            <span className="metric-label">Total invitations</span>
            <div className="metric-value">{total}</div>
            <div className="metric-change">Tracked invitation hashes</div>
          </div>
          <div className="metric-card">
            <span className="metric-label">Feedback Received</span>
            <div className="metric-value">
              {completedCount}
              <small>({conversionRate}%)</small>
            </div>
            <div className="metric-change">Completed submissions</div>
          </div>
          <div className="metric-card">
            <span className="metric-label">Awaiting Guest Response</span>
            <div className="metric-value">{pendingCount}</div>
            <div className="metric-change">Pending touchpoint links</div>
          </div>
          <div className="metric-card">
            <span className="metric-label">Conversion Rate</span>
            <div className="metric-value">
              {conversionRate}
              <small>%</small>
            </div>
            <div className="metric-change">Industry target: &gt; 25%</div>
          </div>
        </section>

        {/* Filter bar */}
        <div className="panel" style={{ padding: "16px 20px", marginBottom: "20px" }}>
          <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap", flex: 1, minWidth: "260px" }}>
              <div style={{ position: "relative", minWidth: "220px", flex: 1 }}>
                <Search
                  size={15}
                  style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }}
                />
                <input
                  type="text"
                  className="auth-input"
                  placeholder="Search by guest, room, or hash token…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ paddingLeft: "32px", height: "36px", fontSize: "12px" }}
                />
              </div>

              <div style={{ display: "flex", border: "1px solid var(--line)", borderRadius: "6px", overflow: "hidden" }}>
                {(["all", "pending", "completed"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatusFilter(s)}
                    style={{
                      padding: "8px 14px",
                      fontSize: "11px",
                      fontWeight: 600,
                      background: statusFilter === s ? "var(--ink)" : "var(--panel)",
                      color: statusFilter === s ? "#fff" : "var(--muted)",
                      border: "none",
                      cursor: "pointer",
                      textTransform: "capitalize",
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ minWidth: "200px" }}>
              <CustomSelect
                value={selectedPropertyFilter}
                onChange={(val) => setSelectedPropertyFilter(val)}
                placeholder="All Properties"
                options={[
                  { value: "all", label: "All Properties" },
                  ...properties.map((p) => ({ value: p.id, label: p.name })),
                ]}
              />
            </div>
          </div>
        </div>

        {/* Invitations Table */}
        <div className="panel" style={{ overflow: "hidden" }}>
          <div className="table-shell">
            <table>
              <thead>
                <tr>
                  <th>Guest &amp; Stay</th>
                  <th>Property</th>
                  <th>Channel</th>
                  <th>Hash Token &amp; Link</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableLoadingRows columns={6} />
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "48px 16px", color: "var(--muted)" }}>
                      No invitations match your filter criteria.
                    </td>
                  </tr>
                ) : (
                  filtered.map((inv) => {
                    const link = getInviteUrl(inv);
                    const isCopied = copiedId === inv.id;
                    return (
                      <tr key={inv.id}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <span className="mini-avatar" style={{ width: "32px", height: "32px", fontSize: "11px" }}>
                              {inv.guestName.slice(0, 2).toUpperCase()}
                            </span>
                            <div>
                              <strong style={{ fontSize: "13px" }}>{inv.guestName}</strong>
                              <span style={{ display: "block", fontSize: "11px", color: "var(--muted)" }}>
                                {inv.roomNumber} · {new Date(inv.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span style={{ fontSize: "12px", color: "var(--ink)" }}>
                            {inv.propertyName || "Assigned Property"}
                          </span>
                        </td>
                        <td>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              fontSize: "11px",
                              padding: "2px 8px",
                              borderRadius: "4px",
                              background: "var(--canvas-alt)",
                              color: "var(--muted)",
                              fontFamily: "var(--font-dm-mono)",
                            }}
                          >
                            {inv.channel === "email" ? (
                              <Mail size={11} />
                            ) : inv.channel === "sms" ? (
                              <Smartphone size={11} />
                            ) : inv.channel === "whatsapp" ? (
                              <MessageSquare size={11} />
                            ) : (
                              <LinkIcon size={11} />
                            )}
                            <span>{inv.channel.replace("_", " ")}</span>
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <code
                              style={{
                                fontSize: "11px",
                                background: "var(--canvas-alt)",
                                padding: "3px 6px",
                                borderRadius: "4px",
                                fontFamily: "var(--font-dm-mono)",
                              }}
                            >
                              {inv.token}
                            </code>
                            <button
                              type="button"
                              onClick={async () => {
                                await navigator.clipboard?.writeText(link);
                                setCopiedId(inv.id);
                                setTimeout(() => setCopiedId(null), 2000);
                              }}
                              className="button button-outline"
                              style={{ padding: "4px 8px", fontSize: "10px" }}
                              title="Copy tracked guest link"
                            >
                              {isCopied ? <Check size={12} /> : <Copy size={12} />}
                              <span>{isCopied ? "Copied" : "Copy"}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => openQrModal(inv)}
                              className="button button-outline"
                              style={{ padding: "4px 8px", fontSize: "10px" }}
                              title="Show QR Code"
                            >
                              <QrCode size={12} />
                            </button>
                            <a
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="button button-outline"
                              style={{ padding: "4px 8px", fontSize: "10px" }}
                              title="Open feedback form with pre-filled details"
                            >
                              <ExternalLink size={12} />
                            </a>
                          </div>
                        </td>
                        <td>
                          {inv.status === "completed" ? (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "5px",
                                background: "var(--sage-soft)",
                                color: "var(--sage-deep)",
                                padding: "3px 8px",
                                borderRadius: "4px",
                                fontSize: "11px",
                                fontWeight: 600,
                              }}
                            >
                              <CheckCircle2 size={13} />
                              <span>Completed {inv.feedbackRating ? `(${inv.feedbackRating}★)` : ""}</span>
                            </span>
                          ) : (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "5px",
                                background: "var(--amber-soft)",
                                color: "var(--amber)",
                                padding: "3px 8px",
                                borderRadius: "4px",
                                fontSize: "11px",
                                fontWeight: 600,
                              }}
                            >
                              <Clock size={13} />
                              <span>Pending</span>
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            type="button"
                            onClick={() => setPendingDelete(inv)}
                            style={{
                              background: "transparent",
                              border: "none",
                              color: "var(--muted)",
                              cursor: "pointer",
                              padding: "4px 6px",
                            }}
                            title="Remove"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Create Invitation Modal */}
        <AnimatePresence>
          {showInviteModal && (
            <motion.div
              className="drawer-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowInviteModal(false)}
            >
              <motion.div
                className="detail-drawer"
                style={{ width: "min(480px, 100%)" }}
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 28, stiffness: 280 }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  className="drawer-close"
                  onClick={() => setShowInviteModal(false)}
                >
                  <X size={18} />
                </button>

                <p className="eyebrow">Personalized Touchpoint</p>
                <h2>Generate guest invitation link</h2>
                <p style={{ color: "var(--muted)", fontSize: "12px", marginBottom: "22px" }}>
                  Create a tracked link for a specific guest or stay. When the guest leaves feedback via this link, their submission is tracked and reconciled.
                </p>

                <form onSubmit={handleCreateInvite} style={{ display: "grid", gap: "16px" }}>
                  <div>
                    <label className="field-label" style={{ display: "block", marginBottom: "6px" }}>
                      Target Hotel Property *
                    </label>
                    <CustomSelect
                      value={propertyId}
                      onChange={(val) => setPropertyId(val)}
                      placeholder="Select property"
                      options={properties.map((p) => ({ value: p.id, label: p.name }))}
                    />
                  </div>

                  <div>
                    <label className="field-label" style={{ display: "block", marginBottom: "6px" }}>
                      Guest Full Name *
                    </label>
                    <input
                      type="text"
                      className="auth-input"
                      placeholder="e.g. Lady Caroline Montagu"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      required
                    />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div>
                      <label className="field-label" style={{ display: "block", marginBottom: "6px" }}>
                        Room / Suite *
                      </label>
                      <input
                        type="text"
                        className="auth-input"
                        placeholder="e.g. Suite 408"
                        value={roomNumber}
                        onChange={(e) => setRoomNumber(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="field-label" style={{ display: "block", marginBottom: "6px" }}>
                        Channel
                      </label>
                      <CustomSelect
                        value={channel}
                        onChange={(value) => setChannel(value as typeof channel)}
                        options={[
                          { value: "direct_link", label: "Direct Link / Concierge" },
                          { value: "email", label: "Email" },
                          { value: "sms", label: "SMS" },
                          { value: "whatsapp", label: "WhatsApp" },
                        ]}
                      />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div>
                      <label className="field-label" style={{ display: "block", marginBottom: "6px" }}>
                        Guest Email (Optional)
                      </label>
                      <input
                        type="email"
                        className="auth-input"
                        placeholder="guest@domain.com"
                        value={guestEmail}
                        onChange={(e) => setGuestEmail(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="field-label" style={{ display: "block", marginBottom: "6px" }}>
                        Guest Phone (Optional)
                      </label>
                      <input
                        type="tel"
                        className="auth-input"
                        placeholder="+44 7700 900142"
                        value={guestPhone}
                        onChange={(e) => setGuestPhone(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="field-label" style={{ display: "block", marginBottom: "6px" }}>
                      Internal Operational Notes
                    </label>
                    <textarea
                      className="auth-input"
                      rows={2}
                      placeholder="e.g. Sent upon spa checkout; VIP Gold tier guest"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>

                  <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
                    <button
                      type="submit"
                      disabled={submitting || !guestName.trim() || !roomNumber.trim()}
                      className="button button-dark"
                      style={{ flex: 1 }}
                    >
                      {submitting ? "Generating Tracked Link…" : "Generate Tracked Link"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowInviteModal(false)}
                      className="button button-outline"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* QR Code Modal for Invitation */}
        <AnimatePresence>
          {qrModalInvite && (
            <motion.div
              className="drawer-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setQrModalInvite(null)}
              style={{ display: "grid", placeItems: "center" }}
            >
              <motion.div
                initial={{ scale: 0.94, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.94, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: "var(--panel)",
                  borderRadius: "6px",
                  padding: "32px",
                  maxWidth: "400px",
                  width: "90%",
                  textAlign: "center",
                  boxShadow: "var(--shadow-lg)",
                  border: "1px solid var(--line)",
                }}
              >
                <p className="eyebrow">Personalized QR Touchpoint</p>
                <h3 style={{ margin: "6px 0 16px" }}>{qrModalInvite.guestName}</h3>
                {qrModalDataUrl && (
                  <img
                    src={qrModalDataUrl}
                    alt="Tracked QR"
                    style={{
                      width: "220px",
                      height: "220px",
                      background: "#fff",
                      padding: "10px",
                      borderRadius: "8px",
                      border: "1px solid var(--line)",
                      margin: "0 auto 16px",
                    }}
                  />
                )}
                <p style={{ fontSize: "12px", color: "var(--muted)", margin: "0 0 16px" }}>
                  {qrModalInvite.roomNumber} · {qrModalInvite.propertyName}
                </p>
                <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
                  <button
                    type="button"
                    className="button button-dark"
                    onClick={async () => {
                      await navigator.clipboard?.writeText(getInviteUrl(qrModalInvite));
                      alert("Invitation URL copied to clipboard!");
                    }}
                  >
                    Copy Link
                  </button>
                  <button
                    type="button"
                    className="button button-outline"
                    onClick={() => setQrModalInvite(null)}
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        <ConfirmDrawer
          open={pendingDelete !== null}
          title="Remove invitation"
          recordName={pendingDelete ? `${pendingDelete.guestName}${pendingDelete.roomNumber ? ` · ${pendingDelete.roomNumber}` : ""}` : ""}
          consequence="This removes the invitation record. The guest link will stop working."
          confirmLabel="Remove invitation"
          pending={deletingInvite}
          onCancel={() => { if (!deletingInvite) setPendingDelete(null); }}
          onConfirm={handleDelete}
        />
      </div>
    </AppShell>
  );
}
