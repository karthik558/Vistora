import { NextRequest, NextResponse } from "next/server";
import { readJson, withWorkspace, text } from "../../../lib/platform/http";
import { assertProperty, checked, serviceDb, PlatformError, workspaceUser } from "../../../lib/platform/db";
import { hasModuleAccess } from "../../../lib/auth/modules";
import { createShortFeedbackLink } from "../../../lib/feedback/public-links";

import { appOrigin } from "../../../lib/platform/appOrigin";

export const POST = withWorkspace(async (request: NextRequest) => {
  const user = workspaceUser();
  if (!hasModuleAccess(user, "feedback")) throw new PlatformError("Feedback module access required.", 403);
  const body = await readJson(request);
  const propertyId = text(body.propertyId, "Property", 50);
  if (!user.isOrganizationAdmin && !user.propertyIds.includes(propertyId)) throw new PlatformError("Assigned property access required.", 403);
  await assertProperty(propertyId);
  const db = serviceDb();
  const property = checked(await db.from("properties").select("id,organization_id,code").eq("id",propertyId).eq("organization_id",user.organizationId).eq("is_active",true).single());
  const departments = ["Front Desk", "Housekeeping", "Food & Beverage", "Concierge", "Facilities & Room", "Spa & Wellness", "Valet & Transfers"];
  const department = text(body.department, "Department", 50, false);
  if (department && !departments.includes(department)) throw new PlatformError("Choose a valid department.");
  const origin = appOrigin(request.nextUrl.origin);
  const token = await createShortFeedbackLink(db, property, { room: text(body.room, "Room", 50, false), department, demo: body.demo === true });
  const path = "/feedback/" + token;
  return NextResponse.json({ success: true, path, url: origin + path }, { headers: { "Cache-Control": "private, no-store" } });
}, "manage_questionnaire");
