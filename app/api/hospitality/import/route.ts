import { NextRequest, NextResponse } from "next/server";
import { withWorkspace } from "../../../../lib/platform/http";
import { checked, workspaceDb, workspaceUser, PlatformError } from "../../../../lib/platform/db";
import { hasModuleAccess } from "../../../../lib/auth/modules";

function authorize() {
  const user = workspaceUser();
  if (!hasModuleAccess(user, "hospitality") || !(user.isOrganizationAdmin || user.rights?.includes("import_guests"))) {
    throw new PlatformError("Permission required to import guest stay reports in hotel operations.", 403);
  }
  return user;
}
export const POST = withWorkspace(async (request: NextRequest) => {
  const user = authorize();
  const body = await request.json();
  if (!body.property_id || !body.request_id || !["partial", "full"].includes(body.mode)) throw new PlatformError("Choose a property and report type.");
  const allowed = user.propertyIds?.length ? user.propertyIds : [user.propertyId];
  if (!user.isOrganizationAdmin && !allowed.includes(body.property_id)) throw new PlatformError("Access to this property is not authorized.", 403);
  if (body.commit && !body.preview_token) throw new PlatformError("Review the report before importing.");
  const response = await workspaceDb().rpc("import_guest_report", {
    p_property: body.property_id, p_records: body.records, p_mode: body.mode,
    p_request: body.request_id, p_preview_token: body.commit ? body.preview_token : null,
  });
  if (response.error?.code === "PGRST202") throw new PlatformError("Apply the guest report reconciliation migration before importing.", 503);
  return NextResponse.json(checked(response));
});
export const GET = withWorkspace(async (request: NextRequest) => {
  authorize();
  let query = workspaceDb().from("guest_imports").select("id,property_id,mode,created_at,result").order("created_at", { ascending: false }).limit(30);
  const property = request.nextUrl.searchParams.get("property");
  if (property && property !== "all") query = query.eq("property_id", property);
  return NextResponse.json({ imports: checked(await query) });
});
