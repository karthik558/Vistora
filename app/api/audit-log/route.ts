import {NextRequest,NextResponse} from "next/server";
import {withWorkspace,text} from "../../../lib/platform/http";
import {workspaceUser,PlatformError} from "../../../lib/platform/db";
import {listAuditLogs,logAuditEvent,AuditCategory} from "../../../lib/services/auditLogService";
export const GET=withWorkspace(async(request:NextRequest)=>NextResponse.json({success:true,logs:await listAuditLogs(Number(request.nextUrl.searchParams.get("limit"))||150,request.nextUrl.searchParams.get("category")||"all")}),"view_audit_log");
export const POST=withWorkspace(async(request:NextRequest)=>{
 const b=await request.json(),user=workspaceUser(),category=b.category||"system";
 if(!["pii_access","export","sla_status","permission","security","system"].includes(category))throw new PlatformError("Invalid category.");
 const log=await logAuditEvent({actorName:user.fullName,actorEmail:user.email,actorRole:user.role,action:text(b.action,"Action",200),category:category as AuditCategory,resource:text(b.resource,"Resource",300),details:text(b.details,"Details",4000,false)});
 return NextResponse.json({success:true,log});
});
