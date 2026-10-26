import {NextRequest,NextResponse} from "next/server";
import {checked,serviceDb,PlatformError} from "../../../../lib/platform/db";
import {errorResponse,number,text} from "../../../../lib/platform/http";
import {hashToken} from "../../../../lib/platform/secrets";
type Context={params:Promise<{token:string}>};
export async function GET(_request:NextRequest,{params}:Context) {
 try {
  const {token}=await params;
  const row=checked(await serviceDb().from("recovery_followups").select("responded_at,expires_at,organizations(name,logo_url,brand_color)").eq("token_hash",hashToken(token)).gt("expires_at",new Date().toISOString()).single());
  return NextResponse.json({success:true,data:row},{headers:{"Cache-Control":"no-store"}});
 }catch(error){return errorResponse(error);}
}
export async function POST(request:NextRequest,{params}:Context) {
 try {
  const {token}=await params,b=await request.json();
  const success=checked(await serviceDb().rpc("respond_recovery",{p_hash:hashToken(token),p_rating:number(b.rating,"Rating",1,5),p_nps:b.recommendationScore==null?null:number(b.recommendationScore,"Recommendation score",0,10),p_comment:text(b.comment,"Comment",2000,false)}));
  if(!success)throw new PlatformError("This link has expired or has already been used.",409);
  return NextResponse.json({success:true});
 }catch(error){return errorResponse(error);}
}
