import { NextRequest, NextResponse } from "next/server";
import { listAuditLogs } from "../../../lib/services/auditLogService";
import { getAuthenticatedUser } from "../../../lib/auth/serverAuth";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    // Allow viewing audit log if authenticated
    if (!user) {
      return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
    }

    const logs = listAuditLogs();
    return NextResponse.json({ success: true, logs });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
