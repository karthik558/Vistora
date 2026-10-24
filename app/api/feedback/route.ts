import { NextRequest, NextResponse } from "next/server";
import {
  fetchFeedbackList,
  createFeedback,
  deleteFeedback,
  updateFeedbackProperty,
} from "../../../lib/services/guestExperienceService";
import { FeedbackStatus } from "../../../types/database";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get("propertyId") || undefined;
    const status = (searchParams.get("status") as FeedbackStatus | "all") || undefined;
    const search = searchParams.get("search") || undefined;

    const list = await fetchFeedbackList({ propertyId, status, search });
    return NextResponse.json({ success: true, data: list });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.rating) {
      return NextResponse.json({ success: false, error: "Rating is required" }, { status: 400 });
    }
    if (!body.propertyId) {
      return NextResponse.json({ success: false, error: "Property selection is mandatory." }, { status: 400 });
    }

    const created = await createFeedback(body);
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userCookie = request.cookies.get("vistora-user")?.value;
    let userRole = "visitor";
    if (userCookie) {
      try {
        const u = JSON.parse(userCookie);
        userRole = u?.role || "visitor";
      } catch {}
    }

    if (userRole !== "admin") {
      return NextResponse.json(
        { success: false, error: "Access Restricted: Only workspace administrators can assign or change feedback properties." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, propertyId } = body;
    if (!id || !propertyId) {
      return NextResponse.json({ success: false, error: "Feedback ID and Property ID are required." }, { status: 400 });
    }

    await updateFeedbackProperty(id, propertyId);
    return NextResponse.json({ success: true, message: "Property assigned successfully." });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const ids = Array.isArray(body.ids) ? body.ids : body.id ? [body.id] : [];
    if (!ids || ids.length === 0) {
      return NextResponse.json({ success: false, error: "No feedback IDs provided" }, { status: 400 });
    }

    const result = await deleteFeedback(ids);
    return NextResponse.json({ success: true, count: result.count });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
