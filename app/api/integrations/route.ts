import {NextRequest,NextResponse} from "next/server";
import {hashToken} from "../../../lib/platform/secrets";
import {checked,serviceDb,PlatformError} from "../../../lib/platform/db";
import {errorResponse} from "../../../lib/platform/http";
import {managementReport,reportRows,reportColumns} from "../../../lib/platform/reports";
export async function GET(request:NextRequest) {
 try {
  const token=request.headers.get("authorization")?.replace(/^Bearer /,"");
  if(!token?.startsWith("vst_"))throw new PlatformError("API key required.",401);
  const db=serviceDb(),key=checked(await db.from("api_keys").select("*").eq("key_hash",hashToken(token)).is("revoked_at",null).gt("expires_at",new Date().toISOString()).single());
  const report=request.nextUrl.searchParams.get("resource")==="reports",scope=report?"reports:read":"feedback:read";
  if(!key.scopes.includes(scope))throw new PlatformError("This key does not have "+scope+" permission.",403);
  checked(await db.from("api_keys").update({last_used_at:new Date().toISOString()}).eq("id",key.id).select("id").single());
  if(report) {
   const days=Math.min(366,Math.max(1,Number(request.nextUrl.searchParams.get("days"))||30));
   return NextResponse.json({success:true,data:managementReport(await reportRows(db,key.organization_id,days),days)},{headers:{"Cache-Control":"no-store"}});
  }
  const offset=Math.max(0,Math.floor(Number(request.nextUrl.searchParams.get("offset"))||0));
  const data=checked(await db.from("feedback").select("id,"+reportColumns).eq("organization_id",key.organization_id).order("created_at",{ascending:false}).order("id").range(offset,offset+99));
  return NextResponse.json({success:true,data,nextOffset:data.length===100?offset+100:null},{headers:{"Cache-Control":"no-store"}});
 }catch(error){return errorResponse(error);}
}
