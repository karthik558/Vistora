import { NextRequest, NextResponse } from "next/server";
import { withWorkspace, text, email, number } from "../../../../lib/platform/http";
import { checked, workspaceDb, workspaceUser, PlatformError } from "../../../../lib/platform/db";
import { hasModuleAccess } from "../../../../lib/auth/modules";
import { canManageServiceJobs } from "../../../../lib/operations/access";
import { newToken } from "../../../../lib/platform/secrets";
import { logAuditEvent } from "../../../../lib/services/auditLogService";

function cleanDate(val: unknown, label: string): string {
  const s = String(val || "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || !Number.isFinite(Date.parse(s))) {
    throw new PlatformError("Enter a valid " + label.toLowerCase() + " (YYYY-MM-DD).");
  }
  return s;
}

export const POST = withWorkspace(async (request: NextRequest) => {
  const user = workspaceUser();
  if (!hasModuleAccess(user, "hospitality")) {
    throw new PlatformError("Hotel operations module access required.", 403);
  }

  const canImport = user.isOrganizationAdmin || user.rights?.includes("import_guests");
  if (!canImport) {
    throw new PlatformError("Permission required to import guest stay reports.", 403);
  }

  const db = workspaceDb();
  const b = await request.json();

  let targetPropertyIds: string[] = [];
  if (Array.isArray(b.property_ids) && b.property_ids.length > 0) {
    targetPropertyIds = b.property_ids.map((id: any) => String(id).trim()).filter(Boolean);
  } else if (b.property_id && typeof b.property_id === "string") {
    targetPropertyIds = [b.property_id.trim()];
  }

  if (targetPropertyIds.length === 0) {
    throw new PlatformError("Choose at least one destination property.");
  }

  // Validate property rights
  if (!user.isOrganizationAdmin) {
    const allowed = Array.isArray(user.propertyIds) && user.propertyIds.length > 0
      ? user.propertyIds
      : (user.propertyId ? [user.propertyId] : []);
    for (const pid of targetPropertyIds) {
      if (!allowed.includes(pid)) {
        throw new PlatformError("Access to property " + pid + " is not authorized.", 403);
      }
    }
  }

  // Validate target properties exist and are active
  const { data: dbProps, error: propErr } = await db
    .from("properties")
    .select("id, name, is_active")
    .in("id", targetPropertyIds);
  if (propErr) checked({ data: dbProps, error: propErr });
  if (!dbProps || dbProps.length === 0) {
    throw new PlatformError("None of the selected properties were found.");
  }
  const activeProps = dbProps.filter((p: any) => p.is_active && targetPropertyIds.includes(p.id));
  if (activeProps.length === 0) {
    throw new PlatformError("All selected properties are inactive.");
  }

  const records = Array.isArray(b.records) ? b.records : [];
  if (records.length === 0) {
    throw new PlatformError("No guest records provided to import.");
  }
  if (records.length > 500) {
    throw new PlatformError("Maximum 500 records allowed per import batch.");
  }

  // 1. Load existing guests for deduplication
  const { data: existingGuests, error: guestErr } = await db
    .from("guests")
    .select("id, full_name, email, phone, vip_tier, preferences")
    .eq("organization_id", user.organizationId);
  if (guestErr) checked({ data: existingGuests, error: guestErr });

  const guestByEmail = new Map<string, any>();
  const guestByPhone = new Map<string, any>();
  const guestByName = new Map<string, any>();

  (existingGuests || []).forEach((g: any) => {
    if (g.email) guestByEmail.set(g.email.toLowerCase().trim(), g);
    if (g.phone) guestByPhone.set(g.phone.replace(/\D/g, ""), g);
    if (g.full_name) guestByName.set(g.full_name.toLowerCase().trim(), g);
  });

  // 2. Load existing rooms for the target properties
  const validPropIds = activeProps.map((p: any) => p.id);
  const { data: existingRooms, error: roomErr } = await db
    .from("hotel_rooms")
    .select("id, property_id, room_number, capacity, status")
    .in("property_id", validPropIds);
  if (roomErr) checked({ data: existingRooms, error: roomErr });

  // Map key: `${property_id}:${room_number}`
  const roomMap = new Map<string, any>();
  (existingRooms || []).forEach((r: any) => {
    roomMap.set(`${r.property_id}:${r.room_number.toLowerCase().trim()}`, r);
  });

  // 3. Load existing stays for deduplication
  const { data: existingStays, error: stayErr } = await db
    .from("stays")
    .select("id, property_id, guest_id, room_id, room_number, check_in_date, check_out_date, status")
    .in("property_id", validPropIds);
  if (stayErr) checked({ data: existingStays, error: stayErr });

  // Map key: `${property_id}:${guest_id}:${room_number}:${check_in_date}`
  const stayMap = new Map<string, any>();
  (existingStays || []).forEach((s: any) => {
    stayMap.set(
      `${s.property_id}:${s.guest_id}:${s.room_number.toLowerCase().trim()}:${s.check_in_date}`,
      s
    );
  });

  const stats = {
    total: records.length,
    guestsCreated: 0,
    guestsReused: 0,
    staysCreated: 0,
    staysUpdated: 0,
    roomsConfigured: 0,
  };

  const today = new Date().toISOString().slice(0, 10);

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const guestName = text(row.guest_name || row.name || row.customer, "Guest name in row " + (i + 1), 100);
    const rawEmail = row.email ? String(row.email).trim().toLowerCase() : null;
    const rawPhone = row.phone ? String(row.phone).trim() : null;
    const phoneDigits = rawPhone ? rawPhone.replace(/\D/g, "") : "";
    const vipTier = text(row.vip_tier || row.tier || "Standard", "Guest tier", 30);
    const preferences = row.preferences ? String(row.preferences).slice(0, 2000) : "";

    // Determine target properties for this row:
    // If a specific property is specified in row, match it; otherwise use the selected property/properties
    let targetPropsForRow: string[] = [];
    if (row.property_id && validPropIds.includes(row.property_id)) {
      targetPropsForRow = [row.property_id];
    } else if (row.property || row.property_name) {
      const matchName = String(row.property || row.property_name).toLowerCase().trim();
      const matched = activeProps.find((p: any) => p.name.toLowerCase().trim() === matchName);
      if (matched && validPropIds.includes(matched.id)) {
        targetPropsForRow = [matched.id];
      }
    }
    if (targetPropsForRow.length === 0) {
      // Use selected property (if single) or all selected properties (if multi)
      targetPropsForRow = validPropIds;
    }

    // Guest Deduplication: Match by Email -> Phone -> Full Name
    let matchedGuest: any = null;
    if (rawEmail && guestByEmail.has(rawEmail)) {
      matchedGuest = guestByEmail.get(rawEmail);
    } else if (phoneDigits && phoneDigits.length >= 7 && guestByPhone.has(phoneDigits)) {
      matchedGuest = guestByPhone.get(phoneDigits);
    } else if (guestByName.has(guestName.toLowerCase().trim())) {
      matchedGuest = guestByName.get(guestName.toLowerCase().trim());
    }

    let guestId: string;
    if (matchedGuest) {
      guestId = matchedGuest.id;
      stats.guestsReused++;
      // If new contact info or preferences provided, update existing profile
      const updates: Record<string, unknown> = {};
      if (rawEmail && !matchedGuest.email) updates.email = rawEmail;
      if (rawPhone && !matchedGuest.phone) updates.phone = rawPhone;
      if (preferences && (!matchedGuest.preferences || matchedGuest.preferences.length < preferences.length)) {
        updates.preferences = preferences;
      }
      if (vipTier && vipTier !== "Standard" && matchedGuest.vip_tier === "Standard") {
        updates.vip_tier = vipTier;
      }
      if (Object.keys(updates).length > 0) {
        await db.from("guests").update(updates).eq("id", guestId);
      }
    } else {
      // Create new central guest profile
      const newGuest = checked(
        await db
          .from("guests")
          .insert({
            organization_id: user.organizationId,
            full_name: guestName,
            email: rawEmail || null,
            phone: rawPhone || null,
            vip_tier: vipTier,
            preferences: preferences || "",
          })
          .select("id, full_name, email, phone, vip_tier, preferences")
          .single()
      );
      guestId = newGuest.id;
      stats.guestsCreated++;

      // Cache locally for subsequent rows in this same batch
      if (rawEmail) guestByEmail.set(rawEmail, newGuest);
      if (phoneDigits) guestByPhone.set(phoneDigits, newGuest);
      guestByName.set(guestName.toLowerCase().trim(), newGuest);
    }

    // Dates
    const arrival = cleanDate(row.check_in_date || row.arrival || today, "Arrival date");
    const departure = cleanDate(row.check_out_date || row.departure || new Date(Date.now() + 86400000).toISOString().slice(0, 10), "Departure date");
    if (departure < arrival) {
      throw new PlatformError("Row " + (i + 1) + ": Departure (" + departure + ") must not precede arrival (" + arrival + ").");
    }

    // Determine stay status: explicit status or active if arrival is today/past
    let stayStatus: "active" | "reserved" = "reserved";
    if (row.status === "active" || row.status === "reserved") {
      stayStatus = row.status;
    } else if (arrival <= today && departure >= today) {
      stayStatus = "active";
    }

    const roomNumber = text(row.room_number || row.room || row.room_no || "General", "Room number in row " + (i + 1), 30);
    const guestCount = Math.max(1, Math.min(20, Number(row.guest_count || row.pax || 1)));

    // Allocate stays to each target property (usually 1, or multiple if multi-property confirmed)
    for (const rowPropId of targetPropsForRow) {
      const roomKey = `${rowPropId}:${roomNumber.toLowerCase().trim()}`;
      let roomObj = roomMap.get(roomKey);

      if (!roomObj) {
        // Auto-create room for target property
        const createdRoom = checked(
          await db
            .from("hotel_rooms")
            .upsert(
              {
                organization_id: user.organizationId,
                property_id: rowPropId,
                room_number: roomNumber,
                floor: text(row.floor || "", "Floor", 30, false),
                room_type: text(row.room_type || "Standard", "Room type", 60),
                capacity: Math.max(2, guestCount),
                status: ["dirty", "clean", "out_of_service"].includes(row.room_status) ? row.room_status : "clean",
                notes: "Imported via daily arrivals report",
                updated_at: new Date().toISOString(),
              },
              { onConflict: "property_id,room_number" }
            )
            .select("id, property_id, room_number, capacity, status")
            .single()
        );
        roomObj = createdRoom;
        roomMap.set(roomKey, roomObj);
        stats.roomsConfigured++;
      }

      // Stay Deduplication: Check if stay already exists
      const stayKey = `${rowPropId}:${guestId}:${roomNumber.toLowerCase().trim()}:${arrival}`;
      const existingStay = stayMap.get(stayKey);

      if (existingStay) {
        // Update existing stay without creating duplicates
        await db
          .from("stays")
          .update({
            check_out_date: departure,
            guest_count: guestCount,
            room_id: roomObj.id,
            status: stayStatus,
          })
          .eq("id", existingStay.id);
        stats.staysUpdated++;
      } else {
        // Create new stay
        const createdStay = checked(
          await db
            .from("stays")
            .insert({
              organization_id: user.organizationId,
              property_id: rowPropId,
              room_id: roomObj.id,
              guest_id: guestId,
              room_number: roomObj.room_number,
              guest_count: guestCount,
              check_in_date: arrival,
              check_out_date: departure,
              public_token: newToken(),
              status: stayStatus,
            })
            .select("id, property_id, guest_id, room_id, room_number, check_in_date, check_out_date, status")
            .single()
        );
        stayMap.set(stayKey, createdStay);
        stats.staysCreated++;
      }
    }
  }

  const propNames = activeProps.map((p: any) => p.name).join(", ");
  await logAuditEvent({
    actorName: user.fullName,
    actorEmail: user.email,
    actorRole: user.role,
    action: "Daily guest & stay report imported",
    category: "system",
    resource: `${records.length} records into ${propNames}`,
  });

  return NextResponse.json({
    success: true,
    message: `Successfully imported ${stats.total} guest records.`,
    imported: stats,
    properties: activeProps.map((p: any) => ({ id: p.id, name: p.name })),
  });
});
