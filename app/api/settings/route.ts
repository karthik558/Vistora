import { NextRequest, NextResponse } from "next/server";
import {
  getApplicationSettings,
  updateApplicationSettings,
  getPropertySetting,
  getAllPropertySettings,
  updatePropertySetting,
} from "../../../lib/services/settingsService";
import { getAuthenticatedUser, requireAdmin } from "../../../lib/auth/serverAuth";
import { logAuditEvent } from "../../../lib/services/auditLogService";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get("propertyId");

    const appSettings = getApplicationSettings();

    if (propertyId) {
      const propSetting = getPropertySetting(propertyId);
      return NextResponse.json({ success: true, appSettings, propertySetting: propSetting });
    }

    const allProps = getAllPropertySettings();
    return NextResponse.json({ success: true, appSettings, propertySettings: allProps });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    const body = await request.json();
    const { type, appSettings, propertyId, propertySetting } = body;

    if (type === "application") {
      // Application settings is strictly admin or super_admin only
      if (user && user.role !== "admin") {
        return NextResponse.json(
          { success: false, error: "Strictly Administrator privileges required to edit Application Settings." },
          { status: 403 }
        );
      }

      const updated = updateApplicationSettings(appSettings || {});
      logAuditEvent({
        actorName: user?.fullName || "Administrator",
        actorEmail: user?.email || "admin@vistora.app",
        actorRole: user?.role || "admin",
        action: "Application Settings Modified",
        resource: "Organization & System Configuration",
        details: `Updated Org: ${updated.organizationName}, Project: ${updated.projectName}`,
      });

      return NextResponse.json({ success: true, appSettings: updated });
    }

    if (type === "property") {
      if (!propertyId) {
        return NextResponse.json({ success: false, error: "Property ID required." }, { status: 400 });
      }

      // If user is not admin, verify assigned to this property
      if (user && user.role !== "admin") {
        const allowed = user.propertyIds?.length
          ? user.propertyIds
          : user.propertyId
          ? [user.propertyId]
          : [];
        if (!allowed.includes(propertyId)) {
          return NextResponse.json(
            { success: false, error: "You only have rights to configure your assigned hotel properties." },
            { status: 403 }
          );
        }
      }

      const updated = updatePropertySetting(propertyId, propertySetting || {});
      logAuditEvent({
        actorName: user?.fullName || "Operations User",
        actorEmail: user?.email || "staff@vistora.app",
        actorRole: user?.role || "staff",
        action: "Property Settings Modified",
        resource: `Property: ${updated.propertyName} (${updated.propertyCode})`,
        details: `Updated configuration. Active status: ${updated.isActive ? "ACTIVE" : "DISABLED"}.`,
      });

      return NextResponse.json({ success: true, propertySetting: updated });
    }

    return NextResponse.json({ success: false, error: "Invalid settings type." }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
