import { NextRequest, NextResponse } from "next/server";
import { withWorkspace, text, number } from "../../../../../lib/platform/http";
import { checked, workspaceDb, workspaceUser, PlatformError } from "../../../../../lib/platform/db";

type Context = { params: Promise<{ id: string }> };

async function getProperty(id: string) {
  return checked(await workspaceDb().from("properties").select("id, name, organization_id, is_active, total_rooms").eq("id", id).single());
}

export const GET = withWorkspace(async (_request: NextRequest, { params }: Context) => {
  const { id } = await params;
  await getProperty(id);
  const db = workspaceDb();
  const rooms = checked(
    await db
      .from("hotel_rooms")
      .select("*")
      .eq("property_id", id)
      .order("room_number", { ascending: true })
      .limit(500)
  );
  return NextResponse.json({ success: true, rooms }, { headers: { "Cache-Control": "no-store" } });
});

export const POST = withWorkspace(async (request: NextRequest, { params }: Context) => {
  const { id } = await params;
  const prop = await getProperty(id);
  const user = workspaceUser();
  const db = workspaceDb();
  const b = await request.json();

  // BULK IMPORT / BATCH CREATION
  if (Array.isArray(b.rooms)) {
    if (b.rooms.length === 0) throw new PlatformError("At least one room is required for bulk import.");
    if (b.rooms.length > 500) throw new PlatformError("Bulk import is limited to 500 rooms per batch.");

    const rows = b.rooms.map((r: any, idx: number) => {
      const roomNum = text(r.room_number, `Room number at row ${idx + 1}`, 30);
      const floor = text(r.floor || "", "Floor", 30, false);
      const roomType = text(r.room_type || "Standard", "Room type", 60);
      const cap = number(Number(r.capacity || 2), "Capacity", 1, 20);
      const status = ["dirty", "clean", "out_of_service", "inspected"].includes(r.status) ? r.status : "clean";

      let notes = text(r.notes || "", "Notes", 2000, false);
      if (r.view && typeof r.view === "string" && r.view.trim()) {
        const viewStr = `View: ${r.view.trim()}`;
        notes = notes ? `${viewStr} · ${notes}` : viewStr;
      }

      return {
        organization_id: user.organizationId,
        property_id: prop.id,
        room_number: roomNum,
        floor,
        room_type: roomType,
        capacity: cap,
        status,
        notes,
        updated_at: new Date().toISOString(),
      };
    });

    const upserted = checked(
      await db
        .from("hotel_rooms")
        .upsert(rows, { onConflict: "property_id,room_number" })
        .select("*")
    );

    // Sync property total_rooms count
    const countRes = await db.from("hotel_rooms").select("id", { count: "exact", head: true }).eq("property_id", prop.id);
    if (countRes.count !== null && countRes.count > 0) {
      await db.from("properties").update({ total_rooms: countRes.count }).eq("id", prop.id);
    }

    return NextResponse.json({ success: true, count: rows.length, rooms: upserted }, { status: 201 });
  }

  // SINGLE ROOM CREATION
  const roomNumber = text(b.room_number, "Room number", 30);
  const floor = text(b.floor || "", "Floor", 30, false);
  const roomType = text(b.room_type || "Standard", "Room type", 60);
  const cap = number(Number(b.capacity || 2), "Capacity", 1, 20);
  const status = b.status || "clean";
  if (!["dirty", "clean", "out_of_service"].includes(status)) {
    throw new PlatformError("Initial room status must be clean, dirty, or out_of_service.");
  }

  let notes = text(b.notes || "", "Notes", 2000, false);
  if (b.view && typeof b.view === "string" && b.view.trim()) {
    const viewStr = `View: ${b.view.trim()}`;
    notes = notes ? `${viewStr} · ${notes}` : viewStr;
  }

  const inserted = checked(
    await db
      .from("hotel_rooms")
      .upsert(
        {
          organization_id: user.organizationId,
          property_id: prop.id,
          room_number: roomNumber,
          floor,
          room_type: roomType,
          capacity: cap,
          status,
          notes,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "property_id,room_number" }
      )
      .select("*")
      .single()
  );

  // Sync property total_rooms count
  const countRes = await db.from("hotel_rooms").select("id", { count: "exact", head: true }).eq("property_id", prop.id);
  if (countRes.count !== null && countRes.count > 0) {
    await db.from("properties").update({ total_rooms: countRes.count }).eq("id", prop.id);
  }

  return NextResponse.json({ success: true, room: inserted }, { status: 201 });
});

export const PATCH = withWorkspace(async (request: NextRequest, { params }: Context) => {
  const { id } = await params;
  await getProperty(id);
  const db = workspaceDb();
  const b = await request.json();

  const roomId = text(b.id, "Room ID", 50);
  const updates: Record<string, unknown> = {};
  if (b.status !== undefined) {
    if (!["dirty", "clean", "out_of_service", "inspected"].includes(b.status)) {
      throw new PlatformError("Invalid room status.");
    }
    updates.status = b.status;
  }
  if (b.room_type !== undefined) updates.room_type = text(b.room_type, "Room type", 60);
  if (b.floor !== undefined) updates.floor = text(b.floor, "Floor", 30, false);
  if (b.capacity !== undefined) updates.capacity = number(Number(b.capacity), "Capacity", 1, 20);
  if (b.notes !== undefined) {
    let notes = text(b.notes, "Notes", 2000, false);
    if (b.view && typeof b.view === "string" && b.view.trim() && !notes.includes("View:")) {
      notes = `View: ${b.view.trim()} · ${notes}`;
    }
    updates.notes = notes;
  }

  if (!Object.keys(updates).length) {
    throw new PlatformError("No changes provided.");
  }

  updates.updated_at = new Date().toISOString();

  const updated = checked(
    await db
      .from("hotel_rooms")
      .update(updates)
      .eq("id", roomId)
      .eq("property_id", id)
      .select("*")
      .single()
  );

  return NextResponse.json({ success: true, room: updated });
});

export const DELETE = withWorkspace(async (request: NextRequest, { params }: Context) => {
  const { id } = await params;
  await getProperty(id);
  const db = workspaceDb();
  const roomId = request.nextUrl.searchParams.get("roomId");
  if (!roomId) throw new PlatformError("Room ID is required.");

  // Check if there are active stays
  const activeStay = await db
    .from("stays")
    .select("id")
    .eq("room_id", roomId)
    .in("status", ["reserved", "active"])
    .maybeSingle();

  if (activeStay?.data) {
    throw new PlatformError("Cannot delete room with active or upcoming reservations. Check out or cancel the stay first.");
  }

  checked(await db.from("hotel_rooms").delete().eq("id", roomId).eq("property_id", id));

  // Sync count
  const countRes = await db.from("hotel_rooms").select("id", { count: "exact", head: true }).eq("property_id", id);
  if (countRes.count !== null) {
    await db.from("properties").update({ total_rooms: countRes.count }).eq("id", id);
  }

  return NextResponse.json({ success: true, message: "Room removed successfully." });
});
