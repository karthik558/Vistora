import { NextRequest, NextResponse } from "next/server";
import { withWorkspace, text } from "../../../lib/platform/http";
import { checked, PlatformError, workspaceDb, workspaceUser } from "../../../lib/platform/db";
import { hasModuleAccess } from "../../../lib/auth/modules";
import { pagedRows } from "../../../lib/platform/pagedRows";
import { canTakeStayFeedback, type InHouseGuest } from "../../../lib/feedback/guest-directory";
import { logAuditEvent } from "../../../lib/services/auditLogService";

function context() {
  const user = workspaceUser();
  if (!hasModuleAccess(user, "feedback")) throw new PlatformError("Feedback module access required.", 403);
  const propertyIds = user.isOrganizationAdmin ? null : user.propertyIds?.length ? user.propertyIds : user.propertyId ? [user.propertyId] : [];
  return { user, propertyIds, db: workspaceDb() };
}
const headers = { "Cache-Control": "private, no-store" };
export const GET = withWorkspace(async () => {
  const { user, propertyIds, db } = context();
  if (propertyIds?.length === 0) return NextResponse.json({ success: true, guests: [], canTakeFeedback: false }, { headers });
  let query = db.from("stays")
    .select("id,property_id,room_number,check_in_date,check_out_date,guests(full_name),properties(name),feedback(count)")
    .eq("organization_id", user.organizationId).eq("status", "active")
    .order("room_number").order("id");
  if (propertyIds) query = query.in("property_id", propertyIds);
  const rows = await pagedRows<any>(query);
  const guests: InHouseGuest[] = rows.map(row => {
    const guest = Array.isArray(row.guests) ? row.guests[0] : row.guests;
    const property = Array.isArray(row.properties) ? row.properties[0] : row.properties;
    return { id: row.id, propertyId: row.property_id, propertyName: property?.name || "Property",
      guestName: canTakeStayFeedback(user) ? guest?.full_name || "Guest" : "Guest", roomNumber: row.room_number,
      checkIn: row.check_in_date, checkOut: row.check_out_date,
      feedbackCount: row.feedback?.[0]?.count || 0 };
  });
  return NextResponse.json({ success: true, guests, canTakeFeedback: canTakeStayFeedback(user) }, { headers });
}, "view_feedback");

export const POST = withWorkspace(async (request: NextRequest) => {
  const { user, propertyIds, db } = context();
  if (!canTakeStayFeedback(user) || propertyIds?.length === 0) throw new PlatformError("Guest-data access is required to open a guest's feedback link.", 403);
  const body = await request.json();
  const stayId = text(body.stayId, "Stay", 36);
  let query = db.from("stays").select("id,public_token,properties(is_active)")
    .eq("id", stayId).eq("organization_id", user.organizationId).eq("status", "active");
  if (propertyIds) query = query.in("property_id", propertyIds);
  const stay = checked(await query.maybeSingle());
  const property = Array.isArray(stay.properties) ? stay.properties[0] : stay.properties;
  if (!property?.is_active) throw new PlatformError("This property's feedback form is unavailable.");
  await logAuditEvent({ actorName: user.fullName, actorEmail: user.email, actorRole: user.role,
    action: "Stay feedback link accessed", category: "pii_access", resource: stay.id });
  return NextResponse.json({ success: true, path: "/feedback/" + encodeURIComponent(stay.public_token) }, { headers });
}, "view_feedback");
