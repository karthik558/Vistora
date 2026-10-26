import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthenticatedUser, publicUser } from "../../../../lib/auth/serverAuth";
import { errorResponse, email } from "../../../../lib/platform/http";
import { PlatformError } from "../../../../lib/platform/db";
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const address = email(body.email);
    if (typeof body.password !== "string" || body.password.length < 6) throw new PlatformError("Enter your password.");
    const auth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY!, {auth:{persistSession:false}});
    const {data,error} = await auth.auth.signInWithPassword({email:address,password:body.password});
    if(error || !data.session) throw new PlatformError("Email or password is incorrect.",401);
    const verified = new NextRequest(request.url,{headers:{authorization:"Bearer "+data.session.access_token}});
    const user = await getAuthenticatedUser(verified);
    const safe = user?publicUser(user):{id:data.user.id,email:data.user.email,fullName:data.user.user_metadata?.full_name||"",role:"visitor"};
    const response = NextResponse.json({success:true,user:safe,needsOnboarding:!user});
    const options = {path:"/",httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax" as const};
    response.cookies.set("sb-access-token",data.session.access_token,{...options,maxAge:data.session.expires_in});
    response.cookies.set("sb-refresh-token",data.session.refresh_token,{...options,maxAge:60*60*24*30});
    response.cookies.set("vistora-user",JSON.stringify(safe),{...options,httpOnly:false,maxAge:data.session.expires_in});
    return response;
  } catch(error) { return errorResponse(error); }
}
