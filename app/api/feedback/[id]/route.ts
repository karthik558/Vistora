import { NextRequest, NextResponse } from "next/server";
import { updateFeedbackStatus } from "../../../../lib/services/guestExperienceService";
import { FeedbackStatus } from "../../../../types/database";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    const body = await request.json();
    const status = body.status as FeedbackStatus;
    const notes = body.notes as string | undefined;

    if (!status) {
      return NextResponse.json({ success: false, error: "Status is required" }, { status: 400 });
    }

    const updated = await updateFeedbackStatus(id, status, notes);
    if (!updated) {
      return NextResponse.json({ success: false, error: "Feedback not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
