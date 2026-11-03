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
}

export function detectDelimiter(headerLine: string): string {
  const commas = (headerLine.match(/,/g) || []).length;
  const semicolons = (headerLine.match(/;/g) || []).length;
  const tabs = (headerLine.match(/\t/g) || []).length;
  if (tabs > commas && tabs > semicolons) return "\t";
  if (semicolons > commas) return ";";
  return ",";
}

export function parseCsvLine(line: string, delimiter = ","): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' || char === "'") {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export function normalizeDate(raw: string): string {
  if (!raw) return "";
  const clean = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  const parsed = Date.parse(clean);
  if (Number.isFinite(parsed)) {
    return new Date(parsed).toISOString().slice(0, 10);
  }
  const parts = clean.split(/[/\-.]/);
  if (parts.length === 3) {
    let [p1, p2, p3] = parts;
    if (p3.length === 2) p3 = "20" + p3;
    if (p1.length === 4) {
      return `${p1}-${p2.padStart(2, "0")}-${p3.padStart(2, "0")}`;
    }
    if (Number(p1) > 12) {
      return `${p3}-${p2.padStart(2, "0")}-${p1.padStart(2, "0")}`;
    }
    return `${p3}-${p1.padStart(2, "0")}-${p2.padStart(2, "0")}`;
  }
  return clean;
}

export function parseGuestReportCsv(text: string): ImportedGuestRecord[] {
  if (!text || typeof text !== "string") return [];
  if (text.startsWith("PK\x03\x04")) {
    throw new Error(
      "Binary Excel (.xlsx) file detected. Please export or 'Save As' CSV (.csv) in Excel to upload your report."
    );
  }

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseCsvLine(lines[0], delimiter).map((h) =>
    h.toLowerCase().trim().replace(/[\s_#-]+/g, "")
  );

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

  if (nameIdx === -1 && roomIdx === -1) return [];

  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  const records: ImportedGuestRecord[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i], delimiter);
    const guestName = (nameIdx !== -1 ? cols[nameIdx] : "") || `Guest in Room ${cols[roomIdx] || i}`;
    const roomNumber = (roomIdx !== -1 ? cols[roomIdx] : "") || "General";
    if (!guestName && !roomNumber) continue;

    const rawIn = checkInIdx !== -1 ? cols[checkInIdx] : "";
    const rawOut = checkOutIdx !== -1 ? cols[checkOutIdx] : "";
    const arrival = normalizeDate(rawIn) || today;
    let departure = normalizeDate(rawOut) || tomorrow;
    if (departure <= arrival) {
      const arrD = new Date(arrival);
      arrD.setDate(arrD.getDate() + 1);
      departure = arrD.toISOString().slice(0, 10);
    }

    records.push({
      id: "row-" + i + "-" + Math.random().toString(36).slice(2, 7),
      guest_name: guestName.trim(),
      email: emailIdx !== -1 && cols[emailIdx] ? cols[emailIdx].trim().toLowerCase() : undefined,
      phone: phoneIdx !== -1 && cols[phoneIdx] ? cols[phoneIdx].trim() : undefined,
      room_number: roomNumber.trim(),
      room_type: typeIdx !== -1 && cols[typeIdx] ? cols[typeIdx].trim() : "Standard",
      check_in_date: arrival,
      check_out_date: departure,
      guest_count: countIdx !== -1 && Number(cols[countIdx]) > 0 ? Math.min(20, Number(cols[countIdx])) : 1,
      vip_tier: tierIdx !== -1 && cols[tierIdx] ? cols[tierIdx].trim() : "Standard",
      preferences: prefIdx !== -1 && cols[prefIdx] ? cols[prefIdx].trim() : "",
    });
  }

  return records;
}
