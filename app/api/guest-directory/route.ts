import { NextRequest, NextResponse } from "next/server";
import { readJson, withWorkspace, text } from "../../../lib/platform/http";
import { checked, PlatformError, workspaceDb, workspaceUser } from "../../../lib/platform/db";
import { hasModuleAccess } from "../../../lib/auth/modules";
import { canTakeStayFeedback } from "../../../lib/feedback/guest-directory";
import { logAuditEvent } from "../../../lib/services/auditLogService";

function context() {
  const user = workspaceUser();
  if (!hasModuleAccess(user, "feedback")) throw new PlatformError("Feedback module access required.", 403);
  const propertyIds = user.isOrganizationAdmin ? null : user.propertyIds?.length ? user.propertyIds : user.propertyId ? [user.propertyId] : [];
  return { user, propertyIds, db: workspaceDb() };
}
const headers = { "Cache-Control": "private, no-store" };
function rpcResult(result: { data: any; error: any }) {
  if (["PGRST202", "42883"].includes(result.error?.code)) throw new PlatformError("Feedback collection setup is pending. Apply supabase/migrations/20261103_feedback_collection.sql.", 503);
  return checked(result);
}
export const GET = withWorkspace(async (request: NextRequest) => {
  const { propertyIds, db } = context();
  const day = request.nextUrl.searchParams.get("day") || null;
  const status = request.nextUrl.searchParams.get("status") || "pending";
  if (day && (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(Date.parse(day)) || new Date(day).toISOString().slice(0, 10) !== day)) throw new PlatformError("Choose a valid date.");
  if (!["pending", "collected", "missed", "reviewed", "all"].includes(status)) throw new PlatformError("Choose a valid collection status.");
  if (propertyIds?.length === 0) return NextResponse.json({ success: true, guests: [], canTakeFeedback: false }, { headers });
  const result = rpcResult(await db.rpc("feedback_collection_directory", { p_day: day, p_status: status }));
  return NextResponse.json(result, { headers });
}, "view_feedback");

export const POST = withWorkspace(async (request: NextRequest) => {
  const { user, propertyIds, db } = context();
  const body = await readJson(request);
  const stayId = text(body.stayId, "Stay", 36);
  if (body.action === "followup") {
    const jobId = rpcResult(await db.rpc("feedback_checkout_followup", { p_stay: stayId }));
    return NextResponse.json({ success: true, jobId }, { headers });
  }
  if (!canTakeStayFeedback(user) || propertyIds?.length === 0) throw new PlatformError("Guest-data access is required to open a guest's feedback link.", 403);
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
