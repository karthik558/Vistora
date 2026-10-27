import { NextRequest,NextResponse } from "next/server";
import { withWorkspace, text } from "../../../../lib/platform/http";
import { checked,workspaceDb,workspaceUser,PlatformError } from "../../../../lib/platform/db";
import { toViewModel,invalidateDashboardCache } from "../../../../lib/services/guestExperienceService";
export const PATCH=withWorkspace(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{
 const {id}=await params,body=await request.json(),db=workspaceDb();
 const current=checked(await db.from("feedback").select("*").eq("id",id).single());
 const updates:Record<string,unknown>={};
 if(body.status!==undefined){if(!["needs_attention","under_review","escalated","resolved"].includes(body.status))throw new PlatformError("Invalid status.");updates.status=body.status;}
 if(body.notes!==undefined)updates.resolution_notes=text(body.notes,"Resolution notes",4000,false);
 if(body.assignedTo!==undefined) {
   const name=text(body.assignedTo,"Assignee",200,false);
   if(name) {
    const profiles=checked(await db.from("profiles").select("id,property_id,property_ids").eq("full_name",name));
    const members=profiles.length?checked(await db.from("organization_members").select("user_id,role").in("user_id",profiles.map(p=>p.id)).eq("is_active",true)):[];
    if(!profiles.some(p=>members.some(m=>m.user_id===p.id&&(["owner","admin"].includes(m.role)||p.property_id===current.property_id||p.property_ids?.includes(current.property_id)))))throw new PlatformError("Choose an active member with access to this property.");
   }
   updates.assigned_to=name||null;
   if(Object.prototype.hasOwnProperty.call(current,"assigned_user_id"))updates.assigned_user_id=null;
 }
 if(body.priority!==undefined){if(!["low","normal","high","critical"].includes(body.priority))throw new PlatformError("Invalid priority.");updates.priority=body.priority;}
 if(body.category!==undefined)updates.category=text(body.category,"Category",60);
 if(body.deadline!==undefined) {if(body.deadline&&!Number.isFinite(Date.parse(body.deadline)))throw new PlatformError("Invalid deadline.");updates.sla_deadline=body.deadline||null;}
 if(!Object.keys(updates).length)throw new PlatformError("No changes supplied.");
 const row=checked(await db.from("feedback").update(updates).eq("id",current.id).select().single());
 invalidateDashboardCache();return NextResponse.json({success:true,data:toViewModel(row)});
},"manage_complaints");
export const DELETE=withWorkspace(async(_request:NextRequest,{params}:{params:Promise<{id:string}>})=>{
 if(!workspaceUser().isOrganizationAdmin)throw new PlatformError("Administrator access required.",403);
 const {id}=await params;checked(await workspaceDb().from("feedback").delete().eq("id",id).select("id").single());
 invalidateDashboardCache();return NextResponse.json({success:true});
});
