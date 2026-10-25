import { NextRequest, NextResponse } from "next/server";
import {
  fetchFeedbackList,
  createFeedback,
  deleteFeedback,
  updateFeedbackProperty,
} from "../../../lib/services/guestExperienceService";
import { FeedbackStatus } from "../../../types/database";
import { getAuthenticatedUser, requireAdmin } from "../../../lib/auth/serverAuth";
import { sanitizeString, sanitizeEmail, isValidUuid } from "../../../lib/security/sanitize";
import { markInvitationCompleted } from "../../../lib/services/invitationsService";
import { logAuditEvent } from "../../../lib/services/auditLogService";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get("propertyId") || undefined;
    const status = (searchParams.get("status") as FeedbackStatus | "all") || undefined;
    const search = searchParams.get("search") || undefined;

    // Strict multi-tenant property access validation
    const user = await getAuthenticatedUser(request);
    let effectivePropertyId = propertyId;

    // Strict multi-tenant property access validation:
    // Super Admins can query all properties globally. Hotel Admins and staff are strictly scoped.
    const isSuperAdmin = user?.orgRole === "super_admin" || (user?.rights || []).includes("org_role:super_admin");
    if (user && !isSuperAdmin) {
      const allowed = user.propertyIds?.length
        ? user.propertyIds
        : user.propertyId
        ? [user.propertyId]
        : [];

      if (propertyId && !allowed.includes(propertyId)) {
        // Prevent unauthorized property data access
        return NextResponse.json({ success: true, data: [] });
      }

      if (!propertyId && allowed.length > 0) {
        effectivePropertyId = allowed[0];
      }
    }

    const list = await fetchFeedbackList({
      propertyId: effectivePropertyId,
      status,
      search: search ? sanitizeString(search, 100) : undefined,
    });

    return NextResponse.json({ success: true, data: list });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const rating = parseInt(body.rating, 10);
    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { success: false, error: "A valid rating between 1 and 5 is required." },
        { status: 400 }
      );
    }

    if (!body.propertyId || !isValidUuid(body.propertyId)) {
      return NextResponse.json(
        { success: false, error: "A valid property selection is mandatory." },
        { status: 400 }
      );
    }

    // Sanitize user inputs to prevent injection and XSS
    const sanitizedPayload = {
      ...body,
      rating,
      guestName: sanitizeString(body.guestName || body.name || "Guest", 100),
      comment: sanitizeString(body.comment, 2000),
      roomNumber: sanitizeString(body.roomNumber, 50),
      guestEmail: body.guestEmail ? sanitizeEmail(body.guestEmail) : undefined,
      guestPhone: body.guestPhone ? sanitizeString(body.guestPhone, 30) : undefined,
      department: sanitizeString(body.department, 50),
      answers: body.answers && typeof body.answers === "object" ? body.answers : {},
    };

    const created = await createFeedback(sanitizedPayload);

    // If submitted via a tracked invitation token, mark invitation as completed
    if (body.publicToken) {
      try {
        markInvitationCompleted(body.publicToken, created.rating, created.id);
      } catch {}
    }

    // Log operational audit trail
    try {
      logAuditEvent({
        actorName: created.name || "Guest",
        actorEmail: created.guestEmail || "guest@vistora.app",
        actorRole: "guest",
        action: created.rating <= 2 ? "Urgent Complaint Logged" : "Guest Feedback Submitted",
        resource: `${created.name} (${created.roomNumber}) · ${created.department}`,
        details: `${created.rating}★ rating received. Status: ${created.statusLabel}.`,
        status: created.rating <= 2 ? "alert" : "success",
      });
    } catch {}

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authCheck = await requireAdmin(request);
    if (authCheck.errorResponse) return authCheck.errorResponse;

    const body = await request.json();
    const { id, propertyId } = body;

    if (!id || !propertyId) {
      return NextResponse.json(
        { success: false, error: "Feedback ID and Property ID are required." },
        { status: 400 }
      );
    }

    if (!isValidUuid(id) || !isValidUuid(propertyId)) {
      return NextResponse.json(
        { success: false, error: "Invalid ID format provided." },
        { status: 400 }
      );
    }

    await updateFeedbackProperty(id, propertyId);
    return NextResponse.json({ success: true, message: "Property assigned successfully." });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authCheck = await requireAdmin(request);
    if (authCheck.errorResponse) return authCheck.errorResponse;

    const body = await request.json();
    const ids = Array.isArray(body.ids) ? body.ids : body.id ? [body.id] : [];

    if (!ids || ids.length === 0) {
      return NextResponse.json({ success: false, error: "No feedback IDs provided" }, { status: 400 });
    }

    const validIds = ids.filter(isValidUuid);
    if (validIds.length === 0) {
      return NextResponse.json({ success: false, error: "No valid UUIDs provided." }, { status: 400 });
    }

    const result = await deleteFeedback(validIds);
    return NextResponse.json({ success: true, count: result.count });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
