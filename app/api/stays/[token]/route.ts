import { NextRequest, NextResponse } from "next/server";
import { fetchStayByToken } from "../../../../lib/services/guestExperienceService";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const stay = await fetchStayByToken(token);
    if (!stay) {
      return NextResponse.json({ success: false, error: "Stay not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: stay });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
