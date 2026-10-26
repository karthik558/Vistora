import { NextRequest,NextResponse } from "next/server";
import { withWorkspace } from "../../../lib/platform/http";
import { getDashboardData } from "../../../lib/services/guestExperienceService";
import { workspaceUser } from "../../../lib/platform/db";
export const GET=withWorkspace(async(request:NextRequest)=>NextResponse.json({success:true,data:await getDashboardData(request.nextUrl.searchParams.get("propertyId")||"all",workspaceUser().propertyIds)}),"view_feedback");
