export interface ImportedGuestRecord {
  id?: string;
  guest_name: string;
  email?: string;
  phone?: string;
  room_number: string;
  room_type?: string;
  check_in_date: string;
  check_out_date: string;
  guest_count: number;
  vip_tier: string;
  preferences?: string;
  property_id?: string;
  property_name?: string;
  status?: "active" | "reserved" | string;
}

export function detectDelimiter(headerLine: string): string {
  const commas = (headerLine.match(/,/g) || []).length;
  const semicolons = (headerLine.match(/;/g) || []).length;
  const tabs = (headerLine.match(/\t/g) || []).length;
  if (tabs > commas && tabs > semicolons) return "\t";
  if (semicolons > commas) return ";";
  return ",";
}

// Apostrophes are ordinary text; only double quotes delimit CSV fields.
function parseCsvRows(text: string, delimiter: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let value = ""; let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { value += '"'; i++; }
      else if (quoted || !value.trim()) quoted = !quoted;
      else throw new Error("Unexpected quote in report.");
    } else if (!quoted && (char === delimiter || char === "\n" || char === "\r")) {
      row.push(value.trim()); value = "";
      if (char !== delimiter) { if (row.some(Boolean)) rows.push(row); row = []; if (char === "\r" && text[i + 1] === "\n") i++; }
    } else value += char;
  }
  if (quoted) throw new Error("Unclosed quote in report.");
  row.push(value.trim()); if (row.some(Boolean)) rows.push(row);
  return rows;
}
export function parseCsvLine(line: string, delimiter = ","): string[] {
  return parseCsvRows(line, delimiter)[0] || [];
}
export function normalizeDate(raw: string): string {
  const clean = (raw || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) throw new Error("Use unambiguous YYYY-MM-DD arrival and departure dates.");
  const date = new Date(clean);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== clean) throw new Error("Invalid date: " + clean);
  return clean;
}

export function parseGuestReportCsv(text: string): ImportedGuestRecord[] {
  if (!text || typeof text !== "string") return [];
  if (text.startsWith("PK\x03\x04")) {
    throw new Error(
      "Binary Excel (.xlsx) file detected. Please export or 'Save As' CSV (.csv) in Excel to upload your report."
    );
  }

  const clean = text.replace(/^\uFEFF/, "");
  const delimiter = detectDelimiter(clean.split(/\r?\n/, 1)[0]);
  const lines = parseCsvRows(clean, delimiter);
  if (lines.length < 2) return [];
  const headers = lines[0].map(h => h.toLowerCase().trim().replace(/[\s_#-]+/g, ""));

  const getIndex = (aliases: string[]) =>
    headers.findIndex((h) => aliases.includes(h));

  const nameIdx = getIndex([
    "guestname",
    "guest",
    "name",
    "fullname",
    "customer",
    "customername",
    "passenger",
    "primaryguest",
  ]);
  const emailIdx = getIndex([
    "email",
    "guestemail",
    "emailaddress",
    "mail",
    "contactemail",
  ]);
  const phoneIdx = getIndex([
    "phone",
    "guestphone",
    "phonenumber",
    "mobile",
    "telephone",
    "tel",
    "contact",
  ]);
  const roomIdx = getIndex([
    "roomnumber",
    "room",
    "roomno",
    "unit",
    "suite",
    "roomid",
    "assignedroom",
  ]);
  const typeIdx = getIndex(["roomtype", "category", "type", "roomcategory"]);
  const checkInIdx = getIndex([
    "checkindate",
    "checkin",
    "arrival",
    "arrivaldate",
    "arrdate",
    "from",
    "startdate",
  ]);
  const checkOutIdx = getIndex([
    "checkoutdate",
    "checkout",
    "departure",
    "departuredate",
    "depdate",
    "to",
    "enddate",
  ]);
  const countIdx = getIndex([
    "guestcount",
    "pax",
    "guests",
    "adults",
    "occupants",
    "partysize",
  ]);
  const tierIdx = getIndex([
    "viptier",
    "vip",
    "tier",
    "guesttier",
    "membership",
    "loyalty",
    "guesttype",
  ]);
  const prefIdx = getIndex([
    "preferences",
    "preference",
    "notes",
    "remarks",
    "specialrequests",
    "comments",
  ]);

  const statusIdx = getIndex(["status", "staystatus"]);
  if ([nameIdx, roomIdx, checkInIdx, checkOutIdx].some(index => index === -1)) {
    throw new Error("Report requires Guest Name, Room Number, Check In Date and Check Out Date columns.");
  }
  const records: ImportedGuestRecord[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i];
    if (cols.length !== headers.length) throw new Error(`Row ${i + 1}: column count does not match the header.`);
    const guestName = cols[nameIdx]; const roomNumber = cols[roomIdx];
    if (!guestName || !roomNumber) throw new Error(`Row ${i + 1}: guest name and room number are required.`);
    const arrival = normalizeDate(cols[checkInIdx]); const departure = normalizeDate(cols[checkOutIdx]);
    if (departure <= arrival) throw new Error(`Row ${i + 1}: departure must be after arrival.`);
    const count = countIdx !== -1 && cols[countIdx] ? Number(cols[countIdx]) : 1;
    if (!Number.isInteger(count) || count < 1 || count > 20) throw new Error(`Row ${i + 1}: guest count must be between 1 and 20.`);
    const status = statusIdx !== -1 ? cols[statusIdx].toLowerCase() : "";
    if (status && !["active", "reserved"].includes(status)) throw new Error(`Row ${i + 1}: status must be active or reserved.`);
    records.push({
      id: "row-" + i + "-" + Math.random().toString(36).slice(2, 7),
      guest_name: guestName.trim(),
      email: emailIdx !== -1 && cols[emailIdx] ? cols[emailIdx].trim().toLowerCase() : undefined,
      phone: phoneIdx !== -1 && cols[phoneIdx] ? cols[phoneIdx].trim() : undefined,
      room_number: roomNumber.trim(),
      room_type: typeIdx !== -1 && cols[typeIdx] ? cols[typeIdx].trim() : "Standard",
      check_in_date: arrival,
      check_out_date: departure,
      guest_count: count,
      status: status || undefined,
      vip_tier: tierIdx !== -1 && cols[tierIdx] ? cols[tierIdx].trim() : "Standard",
      preferences: prefIdx !== -1 && cols[prefIdx] ? cols[prefIdx].trim() : "",
    });
  }

  return records;
}
