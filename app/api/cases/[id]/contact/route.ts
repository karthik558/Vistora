import {NextRequest,NextResponse} from "next/server";
import {withWorkspace} from "../../../../../lib/platform/http";
import {checked,workspaceDb,workspaceUser} from "../../../../../lib/platform/db";
import {logAuditEvent} from "../../../../../lib/services/auditLogService";
export const GET=withWorkspace(async(_request:NextRequest,{params}:{params:Promise<{id:string}>})=>{
 const {id}=await params,db=workspaceDb(),user=workspaceUser();
 checked(await db.from("feedback").select("id").eq("id",id).single());
 const result=await db.from("feedback_contacts").select("email,phone").eq("feedback_id",id).maybeSingle();
 checked({data:true,error:result.error});
 await logAuditEvent({actorName:user.fullName,actorEmail:user.email,actorRole:user.role,action:"Guest contact details revealed",category:"pii_access",resource:id});
 return NextResponse.json({success:true,email:result.data?.email||null,phone:result.data?.phone||null},{headers:{"Cache-Control":"private, no-store"}});
},"view_guest_pii");
