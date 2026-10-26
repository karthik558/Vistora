import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, publicUser } from "../../../../lib/auth/serverAuth";
import { errorResponse } from "../../../../lib/platform/http";
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({success:false,user:null},{status:401});
    const safe = publicUser(user);
    const response = NextResponse.json({success:true,user:safe});
    response.cookies.set("vistora-user", JSON.stringify(safe), {path:"/",httpOnly:false,secure:process.env.NODE_ENV==="production",sameSite:"lax",maxAge:3600});
    response.headers.set("Cache-Control","private, no-store");
    return response;
  } catch(error) { return errorResponse(error); }
}
