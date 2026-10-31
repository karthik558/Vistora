import { NextRequest, NextResponse } from "next/server";
import { withWorkspace, text, email } from "../../../lib/platform/http";
import { PlatformError, workspaceDb } from "../../../lib/platform/db";
import { listInvitations, createInvitation, deleteInvitation, getInvitationById } from "../../../lib/services/invitationsService";
import { logAuditEvent } from "../../../lib/services/auditLogService";
import { sendInvitationEmail } from "../../../lib/platform/email";

export const GET = withWorkspace(
  async (request: NextRequest) =>
    NextResponse.json({
      success: true,
      invitations: await listInvitations(request.nextUrl.searchParams.get("propertyId") || undefined),
    }),
  "manage_questionnaire"
);

export const POST = withWorkspace(async (request: NextRequest) => {
  const b = await request.json();
  const origin = request.headers.get("origin") || request.nextUrl.origin || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // Action: Resend email to guest for an existing invitation
  if (b.action === "resend_email") {
    const invitationId = text(b.invitationId, "Invitation ID", 50);
    const invitation = await getInvitationById(invitationId);
    if (!invitation) throw new PlatformError("Invitation not found.", 404);

    const recipient = b.guestEmail ? email(b.guestEmail) : invitation.guestEmail;
    if (!recipient) {
      throw new PlatformError("A valid guest email address is required to dispatch the invitation.", 400);
    }

    // If new email provided, persist it
    if (b.guestEmail && b.guestEmail !== invitation.guestEmail) {
      await workspaceDb().from("guest_invitations").update({ guest_email: recipient }).eq("id", invitation.id);
      invitation.guestEmail = recipient;
    }

    const propParam = invitation.propertyCode || invitation.propertyId;
    let inviteLink = `${origin}/feedback?token=${invitation.token}&property=${encodeURIComponent(propParam)}&room=${encodeURIComponent(invitation.roomNumber)}&guest=${encodeURIComponent(invitation.guestName)}`;
    if (invitation.guestEmail) inviteLink += `&email=${encodeURIComponent(invitation.guestEmail)}`;
    if (invitation.guestPhone) inviteLink += `&phone=${encodeURIComponent(invitation.guestPhone)}`;

    const sendRes = await sendInvitationEmail({
      recipient,
      guestName: invitation.guestName,
      roomNumber: invitation.roomNumber,
      propertyName: invitation.propertyName,
      inviteLink,
    });

    if (!sendRes.success) {
      return NextResponse.json({
        success: false,
        error: sendRes.error || "Email delivery failed.",
        inviteLink,
      }, { status: 422 });
    }

    await logAuditEvent({
      actorName: "",
      actorEmail: "",
      actorRole: "",
      action: "Guest invitation emailed",
      resource: invitation.id,
      details: `Emailed to ${recipient}`,
    });

    return NextResponse.json({
      success: true,
      message: `Feedback invitation successfully dispatched to ${recipient}.`,
      inviteLink,
    });
  }

  // Action: Create invitation
  const channel = b.channel || "direct_link";
  if (!["direct_link", "email", "sms", "whatsapp"].includes(channel)) {
    throw new PlatformError("Invalid delivery channel.");
  }
  if (channel === "email" && !b.guestEmail) {
    throw new PlatformError("Enter the guest email for email delivery.");
  }
  if (["sms", "whatsapp"].includes(channel) && !b.guestPhone) {
    throw new PlatformError("Enter the guest phone number for this channel.");
  }

  const invitation = await createInvitation({
    guestName: text(b.guestName, "Guest name", 100),
    guestEmail: b.guestEmail ? email(b.guestEmail) : undefined,
    guestPhone: text(b.guestPhone, "Phone", 30, false),
    propertyId: text(b.propertyId, "Property", 50),
    roomNumber: text(b.roomNumber, "Room", 50),
    channel,
    notes: text(b.notes, "Notes", 1000, false),
  });

  const propParam = invitation.propertyCode || invitation.propertyId;
  let inviteLink = `${origin}/feedback?token=${invitation.token}&property=${encodeURIComponent(propParam)}&room=${encodeURIComponent(invitation.roomNumber)}&guest=${encodeURIComponent(invitation.guestName)}`;
  if (invitation.guestEmail) inviteLink += `&email=${encodeURIComponent(invitation.guestEmail)}`;
  if (invitation.guestPhone) inviteLink += `&phone=${encodeURIComponent(invitation.guestPhone)}`;

  let emailSent = false;
  let emailError: string | undefined;
  let message = "Invitation tracking link generated.";

  const shouldSendEmail = b.guestEmail && (b.sendEmail === true || channel === "email");
  if (shouldSendEmail) {
    const sendRes = await sendInvitationEmail({
      recipient: b.guestEmail.trim(),
      guestName: invitation.guestName,
      roomNumber: invitation.roomNumber,
      propertyName: invitation.propertyName,
      inviteLink,
    });

    if (sendRes.success) {
      emailSent = true;
      message = `Invitation created and tracking link sent to ${b.guestEmail}.`;
    } else {
      emailSent = false;
      emailError = sendRes.error;
      message = `Invitation created. Email notice: ${sendRes.error}`;
    }
  }

  await logAuditEvent({
    actorName: "",
    actorEmail: "",
    actorRole: "",
    action: "Guest invitation created",
    resource: invitation.id,
    details: emailSent ? `Sent to ${b.guestEmail}` : undefined,
  });

  return NextResponse.json(
    {
      success: true,
      invitation,
      inviteLink,
      emailSent,
      emailError,
      message,
    },
    { status: 201 }
  );
}, "manage_questionnaire");

export const DELETE = withWorkspace(async (request: NextRequest) => {
  await deleteInvitation(text(request.nextUrl.searchParams.get("id"), "Invitation ID", 50));
  return NextResponse.json({ success: true });
}, "manage_questionnaire");
