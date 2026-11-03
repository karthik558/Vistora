import { NextRequest, NextResponse } from "next/server";
import { resolvePublicFeedbackLink } from "../../../../lib/feedback/public-links";
import { errorResponse } from "../../../../lib/platform/http";
export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const { details } = await resolvePublicFeedbackLink(token);
    return NextResponse.json({ success: true, data: details }, { headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
  } catch (error) { return errorResponse(error); }
}
