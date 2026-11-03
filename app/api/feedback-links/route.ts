import { NextRequest, NextResponse } from "next/server";
import { readJson, withWorkspace, text } from "../../../lib/platform/http";
import { assertProperty, PlatformError, workspaceUser } from "../../../lib/platform/db";
import { hasModuleAccess } from "../../../lib/auth/modules";
import { createPropertyFeedbackToken } from "../../../lib/feedback/public-links";

export const POST = withWorkspace(async (request: NextRequest) => {
  const user = workspaceUser();
  if (!hasModuleAccess(user, "feedback")) throw new PlatformError("Feedback module access required.", 403);
  const body = await readJson(request);
  const propertyId = text(body.propertyId, "Property", 50);
  await assertProperty(propertyId);
  if (!user.isOrganizationAdmin && !user.propertyIds.includes(propertyId)) throw new PlatformError("Assigned property access required.", 403);
  const departments = ["Front Desk", "Housekeeping", "Food & Beverage", "Concierge", "Facilities & Room", "Spa & Wellness", "Valet & Transfers"];
  const department = text(body.department, "Department", 50, false);
  if (department && !departments.includes(department)) throw new PlatformError("Choose a valid department.");
  const token = createPropertyFeedbackToken({ propertyId, room: text(body.room, "Room", 50, false), department, demo: body.demo === true });
  return NextResponse.json({ success: true, path: "/feedback/" + token }, { headers: { "Cache-Control": "private, no-store" } });
}, "manage_questionnaire");
