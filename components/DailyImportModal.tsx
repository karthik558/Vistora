"use client";

import { useState, useRef, useMemo, useEffect, ChangeEvent, FormEvent } from "react";
import {
  X,
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Users,
  Building2,
  Trash2,
  Plus,
  RefreshCw,
  UserPlus,
  Check,
} from "lucide-react";
import { ImportChanges, ImportResult } from "./GuestImportsPage";
import WorkspaceSelect from "./WorkspaceSelect";
import Link from "next/link";
import { hasModuleAccess } from "../lib/auth/modules";
import WorkspaceDateField from "./WorkspaceDateField";
import type { WorkspaceUser } from "./Dashboard";
import {
  ImportedGuestRecord,
  parseGuestReportCsv,
} from "../lib/hospitality/guestReportParser";

const SAMPLE_CSV = "guest_name,email,phone,room_number,room_type,check_in_date,check_out_date,guest_count,vip_tier,preferences\n";

interface DirectoryGuest {
  id: string;
  full_name: string;
  email?: string;
  phone?: string;
  vip_tier?: string;
  preferences?: string;
}

interface DailyImportModalProps {
  open: boolean;
  onClose: () => void;
  properties: { id: string; name: string; is_active?: boolean }[];
  user: WorkspaceUser;
  onImportCompleted?: () => void;
  initialTab?: "file" | "manual";
  initialPropertyId?: string;
  directoryGuests?: DirectoryGuest[];
}

export default function DailyImportModal({
  open,
  onClose,
  properties = [],
  user,
  onImportCompleted,
  initialTab = "file",
  initialPropertyId,
  directoryGuests = [],
}: DailyImportModalProps) {
  // Determine authorized properties for the logged-in user
  const allowedProperties = useMemo(() => {
    if (!properties || properties.length === 0) return [];
    if (user.isOrganizationAdmin) return properties.filter((p) => p.is_active !== false);
    const userPropIds = Array.isArray(user.propertyIds) && user.propertyIds.length > 0
      ? user.propertyIds
      : (user.propertyId ? [user.propertyId] : []);
    if (userPropIds.length === 0) return [];
    return properties.filter((p) => p.is_active !== false && userPropIds.includes(p.id));
  }, [properties, user]);


  // Selected property IDs for import
  const [selectedPropIds, setSelectedPropIds] = useState<string[]>(() => {
    if (initialPropertyId && allowedProperties.some((p) => p.id === initialPropertyId)) {
      return [initialPropertyId];
    }
    return allowedProperties[0] ? [allowedProperties[0].id] : [];
  });

  const dialogRef = useRef<HTMLDialogElement>(null);
  const [importMode, setImportMode] = useState<"partial" | "full">("partial");
  const [emptyConfirmed, setEmptyConfirmed] = useState(false);
  const [review, setReview] = useState<ImportResult | null>(null);
  const pendingRecords = useRef<ImportedGuestRecord[]>([]);
  const requestId = useRef("");
  const fileSequence = useRef(0);
  // Active tab: file upload or manual/NC entry
  const [activeTab, setActiveTab] = useState<"file" | "manual">(initialTab);

  // Records queue for batch import
  const [records, setRecords] = useState<ImportedGuestRecord[]>([]);
  const [fileName, setFileName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Quick Add Mode: new vs from directory
  const [quickMode, setQuickMode] = useState<"new" | "directory">("new");
  const [selectedDirectoryId, setSelectedDirectoryId] = useState("");

  // Manual guest entry state
  const [manualName, setManualName] = useState("");
  const [manualRoom, setManualRoom] = useState("");
  const [manualRoomType, setManualRoomType] = useState("Standard");
  const [manualCheckIn, setManualCheckIn] = useState(new Date().toISOString().slice(0, 10));
  const [manualCheckOut, setManualCheckOut] = useState(
    new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10)
  );
  const [manualTier, setManualTier] = useState("Standard");
  const [manualStatus, setManualStatus] = useState<"active" | "reserved">("active");
  const [manualEmail, setManualEmail] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [manualCount, setManualCount] = useState(1);
  const [manualPref, setManualPref] = useState("");

  // Status & feedback
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resultNotice, setResultNotice] = useState<any>(null);

  // Sync state whenever modal opens
  useEffect(() => {
    if (open) {
      dialogRef.current?.showModal();
      setRecords([]); setFileName("");
      setReview(null); setImportMode("partial"); setEmptyConfirmed(false);
      if (initialTab) setActiveTab(initialTab);
      if (initialPropertyId && allowedProperties.some((p) => p.id === initialPropertyId)) {
        setSelectedPropIds([initialPropertyId]);
      } else if (allowedProperties.length > 0 && !allowedProperties.some(p=>p.id===selectedPropIds[0])) {
        setSelectedPropIds([allowedProperties[0].id]);
      }
      setError("");
      setResultNotice(null);
    } else { dialogRef.current?.close(); fileSequence.current++; }
  // Preserve the report while the parent refreshes its data.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSelectProperty = (propId: string) => {
    setSelectedPropIds([propId]); setError("");
  };

  // Reset when dialog closes
  const handleClose = () => {
    setError("");
    setReview(null);
    fileSequence.current++;
    setResultNotice(null);
    setRecords([]);
    setFileName("");
    onClose();
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `vistora-daily-guest-import-template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const processFile = async (file: File) => {
    if (!file || busy) return;
    setBusy(true);
    const ticket = ++fileSequence.current;
    setError(""); setRecords([]); setFileName(file.name); setEmptyConfirmed(false);
    try {
      if (!/\.(csv|tsv|txt)$/i.test(file.name)) throw new Error("Export your Excel report as CSV before uploading.");
      if (file.size > 2_000_000) throw new Error("Report must be smaller than 2 MB.");
      const parsed = parseGuestReportCsv(await file.text());
      if (ticket !== fileSequence.current) return;
      if (!parsed.length) throw new Error("No guest rows found. Check the file or explicitly confirm an empty property.");
      if (parsed.length > 500) throw new Error("A report can contain up to 500 rooms.");
      setRecords(parsed);
    } catch (error) { if (ticket === fileSequence.current) setError((error as Error).message); }
    finally { if (ticket === fileSequence.current) setBusy(false); }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  // Populate from directory guest
  const handleDirectoryGuestSelect = (guestId: string) => {
    setSelectedDirectoryId(guestId);
    const found = directoryGuests.find((g) => g.id === guestId);
    if (found) {
      setManualName(found.full_name || "");
      setManualEmail(found.email || "");
      setManualPhone(found.phone || "");
      setManualTier(found.vip_tier || "Standard");
      setManualPref(found.preferences || "");
    }
  };

  // Build current manual record
  const buildCurrentManualRecord = (): ImportedGuestRecord | null => {
    if (!manualName.trim()) {
      setError("Guest name is required.");
      return null;
    }
    if (!manualRoom.trim()) {
      setError("Room number is required.");
      return null;
    }
    return {
      id: "manual-" + Math.random().toString(36).slice(2, 8),
      guest_name: manualName.trim(),
      email: manualEmail.trim() || undefined,
      phone: manualPhone.trim() || undefined,
      room_number: manualRoom.trim(),
      room_type: manualRoomType,
      check_in_date: manualCheckIn,
      check_out_date: manualCheckOut,
      guest_count: Number(manualCount) || 1,
      vip_tier: manualTier,
      preferences: manualPref.trim() || undefined,
      status: manualStatus,
    };
  };

  const handleAddManualRecord = (e: FormEvent) => {
    e.preventDefault();
    const newRec = buildCurrentManualRecord();
    if (!newRec) return;
    setImportMode("partial");
    setRecords((prev) => [newRec, ...prev]);
    setManualName("");
    setManualRoom("");
    setManualEmail("");
    setManualPhone("");
    setManualPref("");
    setSelectedDirectoryId("");
    setError("");
  };

  const handleRemoveRecord = (id?: string) => {
    if (!id) return;
    setRecords((prev) => prev.filter((r) => r.id !== id));
    setImportMode("partial");
  };

  // Core execution engine
  const executeImport = async (recordsToImport: ImportedGuestRecord[], commit = false) => {
    if (recordsToImport.length === 0 && !(activeTab === "file" && importMode === "full" && emptyConfirmed)) {
      setError("Please add or upload guest records before importing.");
      return;
    }
    if (!allowedProperties.some(p=>p.id===selectedPropIds[0])) {
      setError("Please choose a destination property.");
      return;
    }
    setBusy(true);
    setError("");
    if (!commit) requestId.current = crypto.randomUUID();
    try {
      const response = await fetch("/api/hospitality/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property_id: selectedPropIds[0],
          mode: activeTab === "manual" ? "partial" : importMode,
          request_id: requestId.current,
          commit,
          preview_token: review?.token,
          records: recordsToImport.map((r) => ({
            guest_name: r.guest_name,
            email: r.email,
            phone: r.phone,
            room_number: r.room_number,
            room_type: r.room_type,
            check_in_date: r.check_in_date,
            check_out_date: r.check_out_date,
            guest_count: r.guest_count,
            vip_tier: r.vip_tier,
            preferences: r.preferences,
            status: r.status,
          })),
        }),
      });

      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.error || "Failed to import guest data.");
      }

      if (commit) { setResultNotice(json); setReview(null); onImportCompleted?.(); }
      else { setReview(json); pendingRecords.current = recordsToImport; }
    } catch (err: any) {
      setError(err.message || "Could not complete import.");
    } finally {
      setBusy(false);
    }
  };

  // Review a single check-in from the Quick Add form
  const handleQuickAddInstantSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const rec = buildCurrentManualRecord();
    if (!rec) return;
    await executeImport([rec]);
  };

  // Batch import trigger
  const handleExecuteImport = () => {
    executeImport(records);
  };

  const selectedPropertyNames = selectedPropIds
    .map((id) => allowedProperties.find((p) => p.id === id)?.name)
    .filter(Boolean)
    .join(" and ");

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="daily-import-title"
      onCancel={e=>{e.preventDefault();if(!busy)handleClose();}}
      style={{
        color: "var(--ink)", font: "inherit",
        border: 0, width: "100vw", height: "100vh", maxWidth: "100vw", maxHeight: "100vh", margin: 0,
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(11, 16, 15, 0.55)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1100,
        padding: "16px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) handleClose();
      }}
    >
      <div
        className="workspace-modal platform-card"
        style={{
          background: "var(--panel, #ffffff)",
          border: "1px solid var(--line)",
          borderRadius: "8px",
          width: "100%",
          maxWidth: "800px",
          padding: "24px",
          boxShadow: "0 24px 54px rgba(0,0,0,0.22)",
          maxHeight: "92vh",
          overflowY: "auto",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "16px",
            borderBottom: "1px solid var(--line)",
            paddingBottom: "14px",
          }}
        >
          <div>
            <h3 id="daily-import-title" style={{ margin: "0 0 4px 0", fontSize: "18px", color: "var(--ink)" }}>
              {activeTab === "manual" ? "Add guest" : "Import for the day"}
            </h3>
            <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)" }}>
              {activeTab === "manual"
                ? "Review a check-in or reservation for a guest, VIP, or NC / complimentary house guest."
                : "Upload current occupancy or selected rooms, then review changes before importing."}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={busy}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "4px",
              color: "var(--muted)",
            }}
            title="Close dialog" aria-label="Close import"
          >
            <X size={18} />
          </button>
        </div>

        {/* Success View */}
        {resultNotice ? (
          <div style={{ padding: "20px 0", textAlign: "center" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                background: "var(--sage-soft)",
                color: "var(--sage-deep)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "14px",
              }}
            >
              <CheckCircle2 size={28} />
            </div>
            <h4 style={{ margin: "0 0 8px 0", fontSize: "17px", color: "var(--ink)" }}>
              {resultNotice.message || "Guest Stays Successfully Processed"}
            </h4>
            <p style={{ margin: "0 0 20px 0", fontSize: "13px", color: "var(--muted)" }}>
              Target property: <strong>{selectedPropertyNames}</strong>
            </p>

            <div
              className="platform-stats"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                gap: "10px",
                marginBottom: "20px",
                textAlign: "left",
              }}
            >
              <article className="platform-stat">
                <span>Total records</span>
                <strong>{resultNotice.imported?.total || 0}</strong>
              </article>
              <article className="platform-stat">
                <span>New guest profiles</span>
                <strong style={{ color: "var(--sage-deep)" }}>
                  {resultNotice.imported?.guestsCreated || 0}
                </strong>
              </article>
              <article className="platform-stat">
                <span>Deduplicated profiles</span>
                <strong>{resultNotice.imported?.guestsReused || 0}</strong>
              </article>
              <article className="platform-stat">
                <span>Stays processed</span>
                <strong>
                  {(resultNotice.imported?.staysCreated || 0) + (resultNotice.imported?.staysUpdated || 0)}
                </strong>
              </article>
              <article className="platform-stat">
                <span>Rooms configured</span>
                <strong>{resultNotice.imported?.roomsConfigured || 0}</strong>
              </article>
            </div>

            <p role="status">{resultNotice.imported?.checkedOut || 0} stays checked out.</p>
            {hasModuleAccess(user,"feedback")&&(user.isOrganizationAdmin||user.rights?.includes("view_feedback"))&&<p><Link className="button button-outline compact" href="/dashboard/directory" onClick={handleClose}>Open guest directory to take feedback</Link></p>}
            <ImportChanges changes={resultNotice.changes || []}/>
            <div style={{ display: "flex", justifyContent: "center", gap: "10px" }}>
              <button
                type="button"
                className="button button-dark"
                onClick={handleClose}
                style={{ minWidth: "120px" }}
              >
                Done
              </button>
            </div>
          </div>
        ) : review ? (
          <section>
            <h4>Review occupancy changes · {selectedPropertyNames}</h4>
            <p>{review.imported.staysCreated} new stays · {review.imported.staysUpdated} existing stays · <strong>{review.imported.checkedOut} check-outs</strong></p>
            {activeTab === "file" && importMode === "full" && <p>Missing previous stays will be checked out now and rooms marked dirty. Scheduled departure dates remain in stay history.</p>}
            <ImportChanges changes={review.changes}/>
            {error && <p role="alert" className="platform-notice">{error}</p>}
            <div className="platform-actions">
              <button className="button button-outline" disabled={busy} onClick={()=>{setReview(null);setError("");}}>Back to report</button>
              <button className="button button-dark" disabled={busy} onClick={()=>executeImport(pendingRecords.current,true)}>{busy?"Importing…":"Confirm import"}</button>
            </div>
          </section>
        ) : (
          <fieldset disabled={busy} style={{border:0,padding:0,margin:0,minWidth:0}}>
            <div className="platform-fields" style={{marginBottom:16}}>
              <label className="hotel-wide-field">Property
                <WorkspaceSelect label="Import property" value={selectedPropIds[0]||""} disabled={busy||allowedProperties.length===0}
                  placeholder="Choose property" onChange={handleSelectProperty}
                  options={allowedProperties.map(property=>({value:property.id,label:property.name}))}/>
              </label>
              {allowedProperties.length===0&&<p role="alert">No active properties are available for your account.</p>}
            </div>

            {/* Error Message */}
            {error && (
              <div
                role="alert"
                className="platform-notice"
                style={{
                  marginBottom: "14px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {/* Mode Tabs */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap", gap: "8px",
                borderBottom: "1px solid var(--line)",
                marginBottom: "16px",
              }}
            >
              <nav className="platform-tabs" style={{ borderBottom: "none", margin: 0, padding: 0 }}>
                <button
                  type="button"
                  aria-current={activeTab === "manual" ? "page" : undefined}
                  onClick={() => {setActiveTab("manual");setImportMode("partial");}}
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  <UserPlus size={13} />
                  <span>Add rooms manually</span>
                </button>
                <button
                  type="button"
                  aria-current={activeTab === "file" ? "page" : undefined}
                  onClick={() => setActiveTab("file")}
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  <Upload size={13} />
                  <span>Upload report</span>
                </button>
              </nav>

              {activeTab === "file" && (
                <button
                  type="button"
                  className="button button-ghost compact"
                  onClick={handleDownloadTemplate}
                  style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11px" }}
                  title="Download default CSV template"
                >
                  <Download size={13} />
                  <span>Download Template (.CSV)</span>
                </button>
              )}
            </div>

            {/* TAB 1: Quick Add & Check-In / NC Guest Entry */}
            {activeTab === "manual" && (
              <form
                onSubmit={handleQuickAddInstantSubmit}
                className="platform-fields"
                style={{
                  padding: "16px",
                  background: "var(--canvas)",
                  borderRadius: "6px",
                  border: "1px solid var(--line)",
                  marginBottom: "16px",
                }}
              >
                {/* Mode Selector if directory guests exist */}
                {directoryGuests.length > 0 && (
                  <div
                    className="hotel-wide-field"
                    style={{ display: "flex", gap: "8px", marginBottom: "6px" }}
                  >
                    <button
                      type="button"
                      className={`button ${quickMode === "new" ? "button-dark" : "button-outline"} compact`}
                      onClick={() => {
                        setQuickMode("new");
                        setSelectedDirectoryId("");
                      }}
                      style={{ fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "5px" }}
                    >
                      <Plus size={13} />
                      <span>New Guest</span>
                    </button>
                    <button
                      type="button"
                      className={`button ${quickMode === "directory" ? "button-dark" : "button-outline"} compact`}
                      onClick={() => setQuickMode("directory")}
                      style={{ fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "5px" }}
                    >
                      <Users size={13} />
                      <span>Choose from Central Directory ({directoryGuests.length})</span>
                    </button>
                  </div>
                )}

                {quickMode === "directory" && directoryGuests.length > 0 && (
                  <label className="hotel-wide-field">
                    Existing guest profile
                    <WorkspaceSelect
                      label="Select existing guest"
                      value={selectedDirectoryId}
                      onChange={handleDirectoryGuestSelect}
                      options={directoryGuests.map((g) => ({
                        value: g.id,
                        label: `${g.full_name}${g.vip_tier && g.vip_tier !== "Standard" ? ` · ${g.vip_tier}` : ""}${g.phone ? ` · ${g.phone}` : ""}`,
                      }))}
                    />
                  </label>
                )}

                <label>
                  Guest name *
                  <input
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    placeholder="e.g. Eleanor Vance"
                    required
                  />
                </label>

                <label>
                  Room number *
                  <input
                    value={manualRoom}
                    onChange={(e) => setManualRoom(e.target.value)}
                    placeholder="e.g. 101, 204, Suite A"
                    required
                  />
                </label>

                <label>
                  Guest tier
                  <WorkspaceSelect
                    label="Guest tier"
                    value={manualTier}
                    onChange={setManualTier}
                    options={[
                      { value: "Standard", label: "Standard" },
                      { value: "VIP", label: "VIP" },
                      { value: "Returning", label: "Returning" },
                      { value: "NC / Complimentary", label: "NC / Complimentary (House Guest)" },
                      { value: "Corporate", label: "Corporate" },
                      { value: "Long Stay", label: "Long Stay" },
                    ]}
                  />
                </label>

                <label>
                  Stay status
                  <WorkspaceSelect
                    label="Stay status"
                    value={manualStatus}
                    onChange={(v: string) => setManualStatus(v as "active" | "reserved")}
                    options={[
                      { value: "active", label: "Check in immediately (In-House Guest)" },
                      { value: "reserved", label: "Upcoming Reservation" },
                    ]}
                  />
                </label>

                <label>
                  Room type
                  <input
                    value={manualRoomType}
                    onChange={(e) => setManualRoomType(e.target.value)}
                    placeholder="e.g. Deluxe, Executive Suite"
                  />
                </label>

                <label>
                  Number of guests
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={manualCount}
                    onChange={(e) => setManualCount(Number(e.target.value))}
                    required
                  />
                </label>

                <label>
                  Arrival date
                  <WorkspaceDateField
                    label="Arrival date"
                    value={manualCheckIn}
                    onChange={setManualCheckIn}
                    required
                  />
                </label>

                <label>
                  Departure date
                  <WorkspaceDateField
                    label="Departure date"
                    value={manualCheckOut}
                    onChange={setManualCheckOut}
                    required
                  />
                </label>

                <label>
                  Email · optional
                  <input
                    type="email"
                    value={manualEmail}
                    onChange={(e) => setManualEmail(e.target.value)}
                    placeholder="guest@example.com"
                  />
                </label>

                <label>
                  Phone · optional
                  <input
                    value={manualPhone}
                    onChange={(e) => setManualPhone(e.target.value)}
                    placeholder="+1 555-0199"
                  />
                </label>

                <label className="hotel-wide-field">
                  Special preferences / NC instructions
                  <input
                    value={manualPref}
                    onChange={(e) => setManualPref(e.target.value)}
                    placeholder="e.g. Complimentary fruit basket, late check-out, high floor"
                  />
                </label>

                <div
                  style={{
                    gridColumn: "span 2",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: "8px",
                  }}
                >
                  <button
                    type="button"
                    className="button button-outline compact"
                    onClick={handleAddManualRecord}
                    style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}
                  >
                    <Plus size={13} />
                    <span>Add to report</span>
                  </button>

                  <button
                    type="submit"
                    className="button button-dark compact"
                    disabled={busy}
                    style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    {busy ? (
                      <>
                        <RefreshCw size={13} className="spin" />
                        <span>Saving…</span>
                      </>
                    ) : (
                      <>
                        <Check size={13} />
                        <span>
                          {manualStatus === "active" ? "Review Check-in" : "Review Reservation"}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* TAB 2: File Upload */}
            {activeTab === "file" && (
              <div>
                <div className="platform-fields" style={{marginBottom:12}}><label className="hotel-wide-field">Report type
                  <WorkspaceSelect label="Report type" value={importMode} disabled={busy}
                    onChange={value=>{setImportMode(value as "partial"|"full");setEmptyConfirmed(false);}}
                    options={[
                      {value:"partial",label:"Partial update",detail:"Update listed rooms only. Omitted stays remain unchanged."},
                      {value:"full",label:"Full in-house report",detail:"Reconcile all occupied rooms and check out missing stays."},
                    ]}/>
                </label></div>
                <p>{importMode==="full"?"Use the latest complete list of occupied rooms for this property. Missing active stays will be checked out; future reservations remain unchanged.":"Import one, two, or more rooms. Omitted rooms remain unchanged."}</p>
                <p>New check-ins require ready rooms and any configured inspection. Resolve conflicting stays before importing.</p>
                {importMode==="full"&&records.length===0&&<label><input type="checkbox" checked={emptyConfirmed} onChange={e=>setEmptyConfirmed(e.target.checked)}/>The property has no in-house guests. Review check-out of all active stays.</label>}

                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  role="button" tabIndex={0} aria-label="Choose guest report"
                  onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();fileInputRef.current?.click();}}}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: `2px dashed ${isDragging ? "var(--ink)" : "var(--line)"}`,
                    borderRadius: "8px",
                    padding: "24px 16px",
                    textAlign: "center",
                    cursor: "pointer",
                    background: isDragging ? "var(--sage-soft)" : "var(--canvas)",
                    transition: "all 0.2s ease",
                    marginBottom: "14px",
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.txt,.tsv"
                    onChange={handleFileChange}
                    style={{ display: "none" }}
                  />
                  <Upload
                    size={28}
                    style={{
                      color: isDragging ? "var(--sage-deep)" : "var(--muted)",
                      marginBottom: "8px",
                    }}
                  />
                  <strong style={{ display: "block", fontSize: "14px", color: "var(--ink)" }}>
                    {fileName ? fileName : "Drag & drop your guest report file here (.csv, .tsv)"}
                  </strong>
                  <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "var(--muted)" }}>
                    Export Excel reports as CSV. Use YYYY-MM-DD dates and one primary guest per room.
                  </p>
                </div>
              </div>
            )}

            {/* Smart Deduplication Information Pill */}
            <div
              style={{
                fontSize: "11px",
                color: "var(--muted)",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                marginBottom: "12px",
              }}
            >
              <CheckCircle2 size={13} style={{ color: "var(--sage-deep)", flexShrink: 0 }} />
              <span>
                <strong>Smart Deduplication Active:</strong> Existing profiles matching by email, phone, or name are reused. Existing bookings for the same room &amp; date are updated without duplicate stays.
              </span>
            </div>

            {/* Parsed / Queued Records Preview Table */}
            {records.length > 0 && (
              <div style={{ marginBottom: "16px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "8px",
                  }}
                >
                  <strong style={{ fontSize: "13px", color: "var(--ink)" }}>
                    Rooms in report ({records.length})
                  </strong>
                  <button
                    type="button"
                    className="button button-ghost compact"
                    onClick={() => {setRecords([]);setImportMode("partial");}}
                    style={{ fontSize: "11px", color: "var(--muted)" }}
                  >
                    Clear batch
                  </button>
                </div>

                <div
                  className="platform-table"
                  style={{
                    maxHeight: "220px",
                    overflowY: "auto",
                    border: "1px solid var(--line)",
                    borderRadius: "6px",
                  }}
                >
                  <table>
                    <thead>
                      <tr>
                        <th>Guest</th>
                        <th>Room</th>
                        <th>Dates</th>
                        <th>Tier</th>
                        <th>Preferences</th>
                        <th style={{ textAlign: "right" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((r, idx) => (
                        <tr key={r.id || idx}>
                          <td>
                            <strong>{r.guest_name}</strong>
                            {(r.email || r.phone) && (
                              <small style={{ display: "block", color: "var(--muted)" }}>
                                {r.email || r.phone}
                              </small>
                            )}
                          </td>
                          <td>
                            <strong>Room {r.room_number}</strong>
                            <small style={{ display: "block", color: "var(--muted)" }}>
                              {r.room_type || "Standard"} · {r.guest_count} pax
                            </small>
                          </td>
                          <td>
                            <small>{r.check_in_date} &rarr; {r.check_out_date}</small>
                          </td>
                          <td>
                            <span
                              style={{
                                fontSize: "10px",
                                padding: "1px 5px",
                                borderRadius: "3px",
                                background: r.vip_tier?.toLowerCase().includes("nc")
                                  ? "var(--accent-warm-soft, #fff8e6)"
                                  : "var(--canvas)",
                                border: "1px solid var(--line)",
                                fontWeight: 600,
                              }}
                            >
                              {r.vip_tier || "Standard"}
                            </span>
                          </td>
                          <td style={{ fontSize: "11px", color: "var(--muted)", maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {r.preferences || "—"}
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <button
                              type="button"
                              onClick={() => handleRemoveRecord(r.id)}
                              style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--muted)", padding: "2px 4px" }}
                              title="Remove from batch"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                </div>
              </div>
            )}

            {/* Footer Actions */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "8px",
                borderTop: "1px solid var(--line)",
                paddingTop: "14px",
                marginTop: "16px",
              }}
            >
              <button
                type="button"
                className="button button-outline"
                onClick={handleClose}
                disabled={busy}
              >
                Cancel
              </button>
              {(records.length > 0 || (activeTab === "file" && importMode === "full" && emptyConfirmed)) && (
                <button
                  type="button"
                  className="button button-dark"
                  onClick={handleExecuteImport}
                  disabled={busy}
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  {busy ? (
                    <>
                      <RefreshCw size={14} className="spin" />
                      <span>Processing batch import…</span>
                    </>
                  ) : (
                    <>
                      <Upload size={14} />
                      <span>
                        Review import
                      </span>
                    </>
                  )}
                </button>
              )}
            </div>
          </fieldset>
        )}
      </div>
    </dialog>
  );
}
