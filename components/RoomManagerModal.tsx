"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, Download, RefreshCw, Trash2, Check, AlertCircle } from "lucide-react";
import WorkspaceSelect from "./WorkspaceSelect";

export interface RoomItem {
  id?: string;
  room_number: string;
  floor: string;
  room_type: string;
  view?: string;
  capacity: number;
  status: string;
  notes?: string;
}

const SAMPLE_CSV = `room_number,floor,room_type,view,capacity,status,notes
101,1,Standard,Garden View,2,clean,King bed ground floor
102,1,Deluxe Room,Ocean View,2,clean,Private balcony with ocean view
103,1,Deluxe Room,Ocean View,2,clean,Twin beds with ocean view
201,2,Executive Suite,City View,4,clean,Living room and master bedroom
202,2,Junior Suite,Pool View,3,clean,Queen bed and lounge sofa
301,3,Presidential Suite,Panoramic Ocean View,6,clean,Penthouse level with jacuzzi`;

const ROOM_TYPE_OPTIONS = [
  { value: "Standard", label: "Standard Room" },
  { value: "Deluxe Room", label: "Deluxe Room" },
  { value: "Superior Room", label: "Superior Room" },
  { value: "Junior Suite", label: "Junior Suite" },
  { value: "Executive Suite", label: "Executive Suite" },
  { value: "Presidential Suite", label: "Presidential Suite" },
  { value: "Villa", label: "Villa / Bungalow" },
  { value: "Penthouse", label: "Penthouse" },
];

const VIEW_OPTIONS = [
  { value: "", label: "No specific view" },
  { value: "Ocean View", label: "Ocean View" },
  { value: "Sea View", label: "Sea View" },
  { value: "City View", label: "City View" },
  { value: "Garden View", label: "Garden View" },
  { value: "Pool View", label: "Pool View" },
  { value: "Mountain View", label: "Mountain View" },
  { value: "Courtyard View", label: "Courtyard View" },
];

const STATUS_OPTIONS = [
  { value: "clean", label: "Clean" },
  { value: "dirty", label: "Dirty" },
  { value: "out_of_service", label: "Out of service" },
];

const PATTERN_OPTIONS = [
  { value: "standard", label: "Floor & number (101, 102... 201)" },
  { value: "hyphen", label: "Hyphenated (1-01, 1-02... 2-01)" },
  { value: "suite", label: "Suites (Suite 101, Suite 201)" },
  { value: "villa", label: "Villas (Villa 1, Villa 2...)" },
];

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' || char === "'") {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export function parseRoomsCsv(text: string): RoomItem[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((h) =>
    h.toLowerCase().trim().replace(/[\s_#-]+/g, "")
  );

  const getIndex = (aliases: string[]) => headers.findIndex((h) => aliases.includes(h));

  const roomIdx = getIndex(["roomnumber", "room", "number", "roomno", "id", "roomid"]);
  const floorIdx = getIndex(["floor", "level"]);
  const typeIdx = getIndex(["roomtype", "type", "category"]);
  const viewIdx = getIndex(["view", "roomview", "facing", "scenery"]);
  const capIdx = getIndex(["capacity", "pax", "maxguests", "guests"]);
  const statusIdx = getIndex(["status", "state", "readiness"]);
  const notesIdx = getIndex(["notes", "description", "details", "amenities"]);

  const rooms: RoomItem[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const numIdx = roomIdx !== -1 ? roomIdx : 0;
    const roomNumber = cols[numIdx]?.trim();
    if (!roomNumber) continue;

    const floor =
      floorIdx !== -1 && cols[floorIdx]
        ? cols[floorIdx].trim()
        : roomNumber.length >= 3 && !isNaN(Number(roomNumber[0]))
        ? roomNumber[0]
        : "1";
    const roomType = typeIdx !== -1 && cols[typeIdx] ? cols[typeIdx].trim() : "Standard";
    const view = viewIdx !== -1 && cols[viewIdx] ? cols[viewIdx].trim() : "";
    const capVal = capIdx !== -1 ? parseInt(cols[capIdx], 10) : 2;
    const capacity = Number.isFinite(capVal) && capVal >= 1 && capVal <= 20 ? capVal : 2;
    let status = statusIdx !== -1 && cols[statusIdx] ? cols[statusIdx].toLowerCase().trim() : "clean";
    if (!["dirty", "clean", "out_of_service", "inspected"].includes(status)) status = "clean";
    const notes = notesIdx !== -1 && cols[notesIdx] ? cols[notesIdx].trim() : "";

    rooms.push({
      room_number: roomNumber,
      floor,
      room_type: roomType,
      view,
      capacity,
      status,
      notes,
    });
  }
  return rooms;
}

export default function RoomManagerModal({
  open,
  onClose,
  properties = [],
  selectedPropertyId = "",
  onRoomsUpdated,
}: {
  open: boolean;
  onClose: () => void;
  properties?: Array<{ id: string; name: string; code: string }>;
  selectedPropertyId?: string;
  onRoomsUpdated?: () => void;
}) {
  const [tab, setTab] = useState<"import" | "generator" | "single" | "inventory">("import");
  const [activePropertyId, setActivePropertyId] = useState<string>(
    selectedPropertyId || (properties.length > 0 ? properties[0].id : "")
  );

  const [existingRooms, setExistingRooms] = useState<any[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Tab 1: CSV Bulk Import
  const [isDragging, setIsDragging] = useState(false);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [parsedRooms, setParsedRooms] = useState<RoomItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tab 2: Floor Generator
  const [genStartFloor, setGenStartFloor] = useState("1");
  const [genEndFloor, setGenEndFloor] = useState("3");
  const [genRoomsPerFloor, setGenRoomsPerFloor] = useState("8");
  const [genRoomType, setGenRoomType] = useState("Standard");
  const [genView, setGenView] = useState("");
  const [genCapacity, setGenCapacity] = useState("2");
  const [genStatus, setGenStatus] = useState("clean");
  const [genPattern, setGenPattern] = useState("standard");
  const [generatedRooms, setGeneratedRooms] = useState<RoomItem[]>([]);

  // Tab 3: Single Room
  const [singleNumber, setSingleNumber] = useState("");
  const [singleFloor, setSingleFloor] = useState("1");
  const [singleType, setSingleType] = useState("Standard");
  const [singleView, setSingleView] = useState("");
  const [singleCapacity, setSingleCapacity] = useState("2");
  const [singleStatus, setSingleStatus] = useState("clean");
  const [singleNotes, setSingleNotes] = useState("");

  const selectedProp = properties.find((p) => p.id === activePropertyId);

  useEffect(() => {
    if (selectedPropertyId && selectedPropertyId !== activePropertyId) {
      setActivePropertyId(selectedPropertyId);
    } else if (!activePropertyId && properties.length > 0) {
      setActivePropertyId(properties[0].id);
    }
  }, [selectedPropertyId, properties]);

  useEffect(() => {
    if (open && activePropertyId) {
      loadRooms(activePropertyId);
    }
  }, [open, activePropertyId]);

  async function loadRooms(propId: string) {
    if (!propId) return;
    setLoadingRooms(true);
    try {
      const res = await fetch(`/api/properties/${propId}/rooms`);
      const json = await res.json();
      if (res.ok && json.success) {
        setExistingRooms(json.rooms || []);
      } else {
        const fb = await fetch(`/api/hospitality?property=${propId}`);
        const fbJson = await fb.json();
        if (fb.ok && fbJson.rooms) setExistingRooms(fbJson.rooms);
      }
    } catch {
      // silent fallback
    } finally {
      setLoadingRooms(false);
    }
  }

  function handleDownloadTemplate() {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "vistora-rooms-template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function handleFile(file: File) {
    if (!file.name.endsWith(".csv") && !file.name.endsWith(".txt")) {
      setError("Please drop a valid .csv file.");
      return;
    }
    setError(null);
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseRoomsCsv(text);
      if (parsed.length === 0) {
        setError("Could not parse room rows from CSV. Please check formatting or use the sample template.");
        setParsedRooms([]);
      } else {
        setParsedRooms(parsed);
        setSuccess(`Parsed ${parsed.length} rooms from ${file.name}. Review below and confirm import.`);
      }
    };
    reader.readAsText(file);
  }

  function handleGeneratePreview() {
    setError(null);
    const start = parseInt(genStartFloor, 10) || 1;
    const end = parseInt(genEndFloor, 10) || 1;
    const perFloor = parseInt(genRoomsPerFloor, 10) || 8;
    const cap = parseInt(genCapacity, 10) || 2;

    if (start < 0 || end < start || end > 99) {
      setError("Please choose a valid floor range (e.g. 1 to 5).");
      return;
    }
    if (perFloor < 1 || perFloor > 50) {
      setError("Rooms per floor must be between 1 and 50.");
      return;
    }

    const rooms: RoomItem[] = [];
    for (let f = start; f <= end; f++) {
      for (let r = 1; r <= perFloor; r++) {
        let roomNum = "";
        if (genPattern === "hyphen") {
          roomNum = `${f}-${String(r).padStart(2, "0")}`;
        } else if (genPattern === "suite") {
          roomNum = `Suite ${f}${String(r).padStart(2, "0")}`;
        } else if (genPattern === "villa") {
          roomNum = `Villa ${rooms.length + 1}`;
        } else {
          roomNum = `${f}${String(r).padStart(2, "0")}`;
        }

        rooms.push({
          room_number: roomNum,
          floor: String(f),
          room_type: genRoomType,
          view: genView,
          capacity: cap,
          status: genStatus,
        });
      }
    }
    setGeneratedRooms(rooms);
    setSuccess(`Generated preview of ${rooms.length} rooms. Click 'Save ${rooms.length} rooms' to save your inventory.`);
  }

  async function handleSaveBulk(roomsToSave: RoomItem[]) {
    if (!activePropertyId) {
      setError("Please select a target property first.");
      return;
    }
    if (roomsToSave.length === 0) {
      setError("No rooms to save.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/properties/${activePropertyId}/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rooms: roomsToSave }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to import rooms");

      setSuccess(`Successfully added ${json.count || roomsToSave.length} rooms!`);
      setParsedRooms([]);
      setGeneratedRooms([]);
      setCsvFileName(null);
      await loadRooms(activePropertyId);
      if (onRoomsUpdated) onRoomsUpdated();
    } catch (err: any) {
      setError(err.message || "Failed to save rooms to database.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateSingle(e: FormEvent) {
    e.preventDefault();
    if (!activePropertyId) {
      setError("Please select a target property.");
      return;
    }
    if (!singleNumber.trim()) {
      setError("Room number is required.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/properties/${activePropertyId}/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room_number: singleNumber.trim(),
          room_type: singleType.trim(),
          floor: singleFloor.trim(),
          view: singleView.trim(),
          capacity: parseInt(singleCapacity, 10) || 2,
          status: singleStatus,
          notes: singleNotes.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to create room");

      setSuccess(`Room ${singleNumber.trim()} created successfully.`);
      setSingleNumber("");
      setSingleView("");
      setSingleNotes("");
      await loadRooms(activePropertyId);
      if (onRoomsUpdated) onRoomsUpdated();
    } catch (err: any) {
      setError(err.message || "Failed to create room.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateRoomStatus(roomId: string, status: string) {
    if (!activePropertyId) return;
    try {
      const res = await fetch(`/api/properties/${activePropertyId}/rooms`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: roomId, status }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to update room status");
      setExistingRooms((prev) => prev.map((r) => (r.id === roomId ? { ...r, status } : r)));
    } catch (err: any) {
      setError(err.message || "Failed to update room status.");
    }
  }

  async function handleDeleteRoom(roomId: string, roomNum: string) {
    if (!window.confirm(`Delete Room ${roomNum}?`)) return;
    try {
      const res = await fetch(`/api/properties/${activePropertyId}/rooms?roomId=${roomId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Could not delete room");
      setSuccess(`Room ${roomNum} deleted.`);
      await loadRooms(activePropertyId);
      if (onRoomsUpdated) onRoomsUpdated();
    } catch (err: any) {
      setError(err.message || "Failed to delete room.");
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(11, 16, 15, 0.45)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1100,
            padding: "16px",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="workspace-modal platform-card"
            role="dialog"
            aria-modal="true"
            style={{
              background: "var(--panel)",
              border: "1px solid var(--line)",
              borderRadius: "8px",
              width: "100%",
              maxWidth: "820px",
              padding: "24px",
              boxShadow: "0 20px 48px rgba(0,0,0,0.18)",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            {/* Header: Clean title matching other Vistora modals (no icons, no hyphens) */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div>
                <p className="eyebrow" style={{ margin: "0 0 4px 0" }}>Hotel Operations</p>
                <h2 style={{ fontSize: "18px", margin: 0, fontWeight: 600, color: "var(--ink)" }}>
                  Room inventory and setup
                </h2>
                <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--muted)" }}>
                  {selectedProp?.name
                    ? `Managing rooms for ${selectedProp.name}`
                    : "Configure individual rooms, batch generate floors, or import from CSV"}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--muted)",
                  padding: "4px",
                }}
                title="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            {/* Target Property Selector using custom WorkspaceSelect */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                padding: "10px 14px",
                background: "var(--canvas)",
                border: "1px solid var(--line)",
                borderRadius: "6px",
                marginBottom: "16px",
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: "1 1 280px" }}>
                <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--ink)", whiteSpace: "nowrap" }}>
                  Target Property:
                </span>
                <div style={{ flex: 1, minWidth: "220px" }}>
                  <WorkspaceSelect
                    label="Selected property"
                    value={activePropertyId}
                    onChange={(val) => setActivePropertyId(val)}
                    options={properties.map((p) => ({
                      value: p.id,
                      label: `${p.name} (${p.code})`,
                    }))}
                  />
                </div>
              </div>
              <span style={{ fontSize: "12px", color: "var(--muted)", whiteSpace: "nowrap" }}>
                <strong style={{ color: "var(--ink)" }}>{existingRooms.length}</strong> configured room{existingRooms.length === 1 ? "" : "s"}
              </span>
            </div>

            {/* Status alerts */}
            {error && (
              <div
                style={{
                  padding: "10px 14px",
                  background: "rgba(185, 28, 28, 0.08)",
                  border: "1px solid rgba(185, 28, 28, 0.25)",
                  borderRadius: "4px",
                  color: "var(--red)",
                  fontSize: "12px",
                  marginBottom: "14px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <AlertCircle size={15} />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div
                style={{
                  padding: "10px 14px",
                  background: "var(--sage-soft)",
                  border: "1px solid var(--sage)",
                  borderRadius: "4px",
                  color: "var(--sage-deep)",
                  fontSize: "12px",
                  marginBottom: "14px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <Check size={15} />
                <span>{success}</span>
              </div>
            )}

            {/* Navigation Tabs - Platform standard */}
            <nav className="platform-tabs" aria-label="Room setup tabs" style={{ marginBottom: "18px" }}>
              <button
                type="button"
                aria-current={tab === "import" ? "page" : undefined}
                onClick={() => { setTab("import"); setError(null); setSuccess(null); }}
              >
                Bulk CSV import
              </button>
              <button
                type="button"
                aria-current={tab === "generator" ? "page" : undefined}
                onClick={() => { setTab("generator"); setError(null); setSuccess(null); }}
              >
                Floor generator
              </button>
              <button
                type="button"
                aria-current={tab === "single" ? "page" : undefined}
                onClick={() => { setTab("single"); setError(null); setSuccess(null); }}
              >
                Add single room
              </button>
              <button
                type="button"
                aria-current={tab === "inventory" ? "page" : undefined}
                onClick={() => { setTab("inventory"); setError(null); setSuccess(null); }}
              >
                Configured rooms ({existingRooms.length})
              </button>
            </nav>

            {/* TAB 1: BULK CSV IMPORT */}
            {tab === "import" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "8px" }}>
                  <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)" }}>
                    Drop your room schedule to auto-populate room numbers, floors, views, types, and capacities.
                  </p>
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="button button-outline compact"
                    style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11px" }}
                  >
                    <Download size={13} />
                    <span>Download template CSV</span>
                  </button>
                </div>

                {/* Drag & Drop Zone */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: isDragging ? "2px dashed var(--sage, #2e5944)" : "1.5px dashed var(--line)",
                    background: isDragging ? "var(--sage-soft)" : "var(--canvas)",
                    borderRadius: "6px",
                    padding: "28px 16px",
                    textAlign: "center",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    marginBottom: "16px",
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.txt"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleFile(e.target.files[0]);
                    }}
                  />
                  <Upload size={24} style={{ color: "var(--muted)", margin: "0 auto 8px" }} />
                  <p style={{ margin: "0 0 4px 0", fontSize: "13px", fontWeight: 600, color: "var(--ink)" }}>
                    {csvFileName ? csvFileName : "Drag and drop your room CSV file here, or click to browse"}
                  </p>
                  <p style={{ margin: 0, fontSize: "11px", color: "var(--muted)" }}>
                    Columns supported: room_number, floor, room_type, view, capacity, status, notes
                  </p>
                </div>

                {/* Parsed Preview Table */}
                {parsedRooms.length > 0 && (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                      <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink)" }}>
                        Ready to import: {parsedRooms.length} rooms
                      </span>
                      <button
                        type="button"
                        className="button button-dark compact"
                        disabled={saving}
                        onClick={() => handleSaveBulk(parsedRooms)}
                        style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                      >
                        <Check size={13} />
                        <span>{saving ? "Importing rooms…" : `Import ${parsedRooms.length} rooms`}</span>
                      </button>
                    </div>
                    <div className="platform-table" style={{ maxHeight: "260px", overflowY: "auto" }}>
                      <table>
                        <thead>
                          <tr>
                            <th>Room</th>
                            <th>Floor</th>
                            <th>Type</th>
                            <th>View</th>
                            <th>Capacity</th>
                            <th>State</th>
                            <th>Notes</th>
                            <th style={{ textAlign: "right" }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parsedRooms.map((r, i) => (
                            <tr key={i}>
                              <td><strong>{r.room_number}</strong></td>
                              <td>{r.floor}</td>
                              <td>{r.room_type}</td>
                              <td style={{ color: "var(--muted)" }}>{r.view || "—"}</td>
                              <td>{r.capacity} pax</td>
                              <td>{r.status}</td>
                              <td style={{ color: "var(--muted)", maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {r.notes || "—"}
                              </td>
                              <td style={{ textAlign: "right" }}>
                                <button
                                  type="button"
                                  onClick={() => setParsedRooms((prev) => prev.filter((_, idx) => idx !== i))}
                                  style={{ background: "transparent", border: "none", color: "var(--red)", cursor: "pointer", padding: "2px" }}
                                  title="Remove row"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: FLOOR GENERATOR */}
            {tab === "generator" && (
              <div>
                <p style={{ margin: "0 0 14px 0", fontSize: "12px", color: "var(--muted)" }}>
                  Generate sequential room numbers across multiple floors with default room types and views.
                </p>

                <div className="platform-fields" style={{ marginBottom: "16px" }}>
                  <label>
                    Start floor
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={genStartFloor}
                      onChange={(e) => setGenStartFloor(e.target.value)}
                      required
                    />
                  </label>
                  <label>
                    End floor
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={genEndFloor}
                      onChange={(e) => setGenEndFloor(e.target.value)}
                      required
                    />
                  </label>
                  <label>
                    Rooms per floor
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={genRoomsPerFloor}
                      onChange={(e) => setGenRoomsPerFloor(e.target.value)}
                      required
                    />
                  </label>
                  <label>
                    Numbering pattern
                    <WorkspaceSelect
                      label="Numbering pattern"
                      value={genPattern}
                      onChange={setGenPattern}
                      options={PATTERN_OPTIONS}
                    />
                  </label>
                  <label>
                    Room type
                    <WorkspaceSelect
                      label="Room type"
                      value={genRoomType}
                      onChange={setGenRoomType}
                      options={ROOM_TYPE_OPTIONS}
                    />
                  </label>
                  <label>
                    View
                    <WorkspaceSelect
                      label="View"
                      value={genView}
                      onChange={setGenView}
                      options={VIEW_OPTIONS}
                    />
                  </label>
                  <label>
                    Capacity
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={genCapacity}
                      onChange={(e) => setGenCapacity(e.target.value)}
                      required
                    />
                  </label>
                  <label>
                    Initial state
                    <WorkspaceSelect
                      label="Initial state"
                      value={genStatus}
                      onChange={setGenStatus}
                      options={STATUS_OPTIONS}
                    />
                  </label>
                </div>

                <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
                  <button
                    type="button"
                    className="button button-outline compact"
                    onClick={handleGeneratePreview}
                    style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    <RefreshCw size={13} />
                    <span>Generate preview rows</span>
                  </button>
                </div>

                {/* Preview Table */}
                {generatedRooms.length > 0 && (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                      <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink)" }}>
                        Generated {generatedRooms.length} rooms
                      </span>
                      <button
                        type="button"
                        className="button button-dark compact"
                        disabled={saving}
                        onClick={() => handleSaveBulk(generatedRooms)}
                        style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                      >
                        <Check size={13} />
                        <span>{saving ? "Saving rooms…" : `Save ${generatedRooms.length} rooms`}</span>
                      </button>
                    </div>
                    <div className="platform-table" style={{ maxHeight: "260px", overflowY: "auto" }}>
                      <table>
                        <thead>
                          <tr>
                            <th>Room</th>
                            <th>Floor</th>
                            <th>Type</th>
                            <th>View</th>
                            <th>Capacity</th>
                            <th>State</th>
                            <th style={{ textAlign: "right" }}>Remove</th>
                          </tr>
                        </thead>
                        <tbody>
                          {generatedRooms.map((r, i) => (
                            <tr key={i}>
                              <td><strong>{r.room_number}</strong></td>
                              <td>{r.floor}</td>
                              <td>{r.room_type}</td>
                              <td style={{ color: "var(--muted)" }}>{r.view || "—"}</td>
                              <td>{r.capacity} pax</td>
                              <td>{r.status}</td>
                              <td style={{ textAlign: "right" }}>
                                <button
                                  type="button"
                                  onClick={() => setGeneratedRooms((prev) => prev.filter((_, idx) => idx !== i))}
                                  style={{ background: "transparent", border: "none", color: "var(--red)", cursor: "pointer", padding: "2px" }}
                                  title="Remove row"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: SINGLE ROOM */}
            {tab === "single" && (
              <form className="platform-fields" onSubmit={handleCreateSingle}>
                <label>
                  Room number
                  <input
                    type="text"
                    placeholder="e.g. 101, 204, Suite 3"
                    value={singleNumber}
                    onChange={(e) => setSingleNumber(e.target.value)}
                    required
                    maxLength={30}
                  />
                </label>
                <label>
                  Floor
                  <input
                    type="text"
                    placeholder="e.g. 1, 2, G"
                    value={singleFloor}
                    onChange={(e) => setSingleFloor(e.target.value)}
                    maxLength={30}
                  />
                </label>
                <label>
                  Room type
                  <WorkspaceSelect
                    label="Room type"
                    value={singleType}
                    onChange={setSingleType}
                    options={ROOM_TYPE_OPTIONS}
                  />
                </label>
                <label>
                  View · optional
                  <WorkspaceSelect
                    label="View"
                    value={singleView}
                    onChange={setSingleView}
                    options={VIEW_OPTIONS}
                  />
                </label>
                <label>
                  Capacity
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={singleCapacity}
                    onChange={(e) => setSingleCapacity(e.target.value)}
                    required
                  />
                </label>
                <label>
                  Initial state
                  <WorkspaceSelect
                    label="Initial state"
                    value={singleStatus}
                    onChange={setSingleStatus}
                    options={STATUS_OPTIONS}
                  />
                </label>
                <label className="hotel-wide-field">
                  Amenities and notes · optional
                  <input
                    type="text"
                    placeholder="King bed, private balcony, jacuzzi, connecting door..."
                    value={singleNotes}
                    onChange={(e) => setSingleNotes(e.target.value)}
                    maxLength={500}
                  />
                </label>
                <div style={{ gridColumn: "span 2", marginTop: "10px" }}>
                  <button
                    type="submit"
                    className="button button-dark"
                    disabled={saving || !singleNumber.trim()}
                  >
                    {saving ? "Saving room…" : "Add room"}
                  </button>
                </div>
              </form>
            )}

            {/* TAB 4: CONFIGURED ROOMS */}
            {tab === "inventory" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)" }}>
                    Active inventory registered for {selectedProp?.name || "this property"}.
                  </p>
                  <button
                    type="button"
                    className="button button-ghost compact"
                    onClick={() => loadRooms(activePropertyId)}
                    disabled={loadingRooms}
                    style={{ fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                  >
                    <RefreshCw size={12} />
                    <span>Refresh</span>
                  </button>
                </div>

                {loadingRooms ? (
                  <p style={{ padding: "16px 0", color: "var(--muted)", fontSize: "12px" }}>Loading rooms…</p>
                ) : existingRooms.length === 0 ? (
                  <div style={{ padding: "24px", textAlign: "center", background: "var(--canvas)", borderRadius: "6px" }}>
                    <p style={{ margin: "0 0 10px 0", color: "var(--muted)", fontSize: "12px" }}>
                      No individual rooms registered for this property yet.
                    </p>
                    <button type="button" className="button button-dark compact" onClick={() => setTab("import")}>
                      Bulk import via CSV
                    </button>
                  </div>
                ) : (
                  <div className="platform-table" style={{ maxHeight: "320px", overflowY: "auto" }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Room</th>
                          <th>Type / Capacity</th>
                          <th>Floor</th>
                          <th>Notes / View</th>
                          <th>Readiness</th>
                          <th style={{ textAlign: "right" }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {existingRooms.map((r: any) => (
                          <tr key={r.id}>
                            <td><strong>{r.room_number}</strong></td>
                            <td>{r.room_type} · {r.capacity} pax</td>
                            <td style={{ color: "var(--muted)" }}>{r.floor || "—"}</td>
                            <td style={{ color: "var(--muted)", maxWidth: "180px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {r.notes || "—"}
                            </td>
                            <td>
                              <WorkspaceSelect
                                label={"Update room " + r.room_number}
                                value={r.status}
                                onChange={(s) => handleUpdateRoomStatus(r.id, s)}
                                options={[
                                  ...(r.status === "inspected" ? [{ value: "inspected", label: "Inspected" }] : []),
                                  ...STATUS_OPTIONS,
                                ]}
                              />
                            </td>
                            <td style={{ textAlign: "right" }}>
                              <button
                                type="button"
                                onClick={() => handleDeleteRoom(r.id, r.room_number)}
                                style={{ background: "transparent", border: "none", color: "var(--red)", cursor: "pointer", padding: "4px" }}
                                title="Delete room"
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", borderTop: "1px solid var(--line)", paddingTop: "16px", marginTop: "18px" }}>
              <button type="button" className="button button-dark" onClick={onClose}>
                Done
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
