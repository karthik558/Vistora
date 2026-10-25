import { NextRequest, NextResponse } from "next/server";
import {
  listInvitations,
  createInvitation,
  deleteInvitation,
} from "../../../lib/services/invitationsService";
import { getAuthenticatedUser } from "../../../lib/auth/serverAuth";
import { logAuditEvent } from "../../../lib/services/auditLogService";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get("propertyId") || undefined;
    const items = listInvitations(propertyId);
    return NextResponse.json({ success: true, invitations: items });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    const body = await request.json();
    const { guestName, guestEmail, guestPhone, propertyId, propertyName, roomNumber, channel, notes } = body;

    if (!guestName || !guestName.trim()) {
      return NextResponse.json({ success: false, error: "Guest name is required." }, { status: 400 });
    }
    if (!propertyId) {
      return NextResponse.json({ success: false, error: "Property is required." }, { status: 400 });
    }
    if (!roomNumber || !roomNumber.trim()) {
      return NextResponse.json({ success: false, error: "Room or touchpoint identifier is required." }, { status: 400 });
    }

    const invitation = createInvitation({
      guestName,
      guestEmail,
      guestPhone,
      propertyId,
      propertyName,
      roomNumber,
      channel,
      notes,
    });

    logAuditEvent({
      actorName: user?.fullName || "Operations User",
      actorEmail: user?.email || "system@vistora.app",
      actorRole: user?.role || "staff",
      action: "Guest Invitation Generated",
      resource: `Guest: ${invitation.guestName} (${invitation.roomNumber})`,
      details: `Generated tracked token ${invitation.token} via ${invitation.channel}.`,
    });

    return NextResponse.json({ success: true, invitation }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, error: "Invitation ID required." }, { status: 400 });
    }

    const ok = deleteInvitation(id);
    return NextResponse.json({ success: ok });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
