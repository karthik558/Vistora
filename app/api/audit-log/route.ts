import { NextRequest, NextResponse } from "next/server";
import { listAuditLogs, logAuditEvent, AuditCategory } from "../../../lib/services/auditLogService";
import { getAuthenticatedUser } from "../../../lib/auth/serverAuth";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") || "all";
    const limit = parseInt(searchParams.get("limit") || "150", 10);

    const logs = listAuditLogs(limit, category);
    return NextResponse.json({ success: true, logs, authenticated: !!user });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    const body = await request.json();

    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "10.0.4.18 (Encrypted VLAN)";

    const actorName = user?.fullName || body.actorName || "Operational Staff";
    const actorEmail = user?.email || body.actorEmail || "staff@vistora.app";
    const actorRole = user?.role || body.actorRole || "staff";

    const log = logAuditEvent({
      actorName,
      actorEmail,
      actorRole,
      action: body.action || "Workspace Operation",
      category: (body.category as AuditCategory) || "system",
      resource: body.resource || "General Resource",
      details: body.details,
      ip: clientIp,
      status: body.status || "success",
      complianceTag: body.complianceTag,
    });

    return NextResponse.json({ success: true, log });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
