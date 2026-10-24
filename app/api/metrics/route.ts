import { NextRequest, NextResponse } from "next/server";
import { getDashboardData } from "../../../lib/services/guestExperienceService";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get("propertyId") || "all";
    const data = await getDashboardData(propertyId);
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
