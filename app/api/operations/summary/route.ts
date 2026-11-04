import { NextRequest, NextResponse } from "next/server";
import { withWorkspace } from "../../../../lib/platform/http";
import { checked, PlatformError, workspaceDb, workspaceUser } from "../../../../lib/platform/db";
import { hasModuleAccess } from "../../../../lib/auth/modules";
import { uuid } from "../../../../lib/omniops/validation";

export const GET = withWorkspace(async (request: NextRequest) => {
  const user = workspaceUser(), db = workspaceDb();
  if (!hasModuleAccess(user, "hospitality")) throw new PlatformError("Hotel operations access required.", 403);
  const property = request.nextUrl.searchParams.get("property") || "all";
  if (property !== "all") checked(await db.from("properties").select("id").eq("id", uuid(property, "Property")).single());
  const scope = (query: any) => property === "all" ? query : query.eq("property_id", property);
  const canViewFeedback = user.isOrganizationAdmin || (hasModuleAccess(user, "feedback") && user.rights.includes("view_feedback"));
  const [properties, ...counts] = await Promise.all([
    db.from("properties").select("id,name").eq("is_active", true).order("name"),
    scope(db.from("service_jobs").select("id", { count: "exact", head: true }).in("status", ["open", "in_progress"])),
    scope(db.from("service_jobs").select("id", { count: "exact", head: true }).eq("status", "completed")),
    scope(db.from("service_jobs").select("id", { count: "exact", head: true }).in("status", ["open", "in_progress"]).gt("escalation_level", 0)),
    canViewFeedback ? scope(db.from("feedback").select("id", { count: "exact", head: true })) : Promise.resolve({ count: null, error: null }),
  ]);
  counts.forEach((result, index) => {
    checked({ data: true, error: result.error });
    if (result.count === null && (index !== 3 || canViewFeedback)) throw new PlatformError("Could not load summary counts.", 503);
  });
  return NextResponse.json({ properties: checked(properties), active: counts[0].count, resolved: counts[1].count,
    escalated: counts[2].count, feedback: counts[3].count }, { headers: { "Cache-Control": "private, no-store" } });
});
