import { NextRequest, NextResponse } from "next/server";
import { fetchFeedbackList, createFeedback } from "../../../lib/services/guestExperienceService";
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

    const created = await createFeedback(body);
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
