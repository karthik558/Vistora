import {NextRequest,NextResponse} from "next/server";
import {withWorkspace,text,number} from "../../../lib/platform/http";
import {checked,workspaceDb,workspaceUser,PlatformError} from "../../../lib/platform/db";
function requireViewRoleMapping(){
 const user=workspaceUser();
 if(!user.isOrganizationAdmin&&!user.rights?.includes("view_role_mapping")&&!user.rights?.includes("manage_role_mapping"))throw new PlatformError("Role mapping view access required.",403);
}
function requireManageRoleMapping(){
 const user=workspaceUser();
 if(!user.isOrganizationAdmin&&!user.rights?.includes("manage_role_mapping"))throw new PlatformError("Role mapping manage access required.",403);
}
export const GET=withWorkspace(async()=>{
 requireViewRoleMapping();const db=workspaceDb(),org=workspaceUser().organizationId,caller=workspaceUser();
 const callerIsSuperAdmin=caller.isOrganizationAdmin||caller.orgRole==="super_admin"||(caller.rights||[]).includes("org_role:super_admin");
 const [rules,properties,members]=await Promise.all([
  db.from("role_mappings").select("*").eq("organization_id",org).order("created_at"),
  db.from("properties").select("id,name,country,is_active").eq("organization_id",org).order("name"),
  db.from("organization_members").select("user_id,role").eq("organization_id",org).eq("is_active",true)
 ]);
 if(rules.error&&["42P01","PGRST205"].includes(rules.error.code))throw new PlatformError("Role mapping setup is pending. Apply supabase/migrations/20261027_role_mapping.sql after schema sections 12–25.",503);
 const ready=await db.rpc("complaint_schema_ready");if(ready.error||ready.data!==true)throw new PlatformError("Escalation setup is pending. Apply 20261028_complaint_escalation.sql (section 27) after section 26.",503);
 const active=checked(members);
 let team=active.length?checked(await db.from("profiles").select("id,full_name,email,property_id,property_ids,rights,role").eq("organization_id",org).in("id",active.map(m=>m.user_id))):[];
 if(!callerIsSuperAdmin){
  const ownerMemberIds=new Set(active.filter(m=>m.role==="owner").map(m=>m.user_id));
  team=team.filter((p:any)=>{
   if(ownerMemberIds.has(p.id))return false;
   if(p.role==="super_admin")return false;
   const r=Array.isArray(p.rights)?p.rights:[];
   if(r.includes("org_role:super_admin"))return false;
   return true;
  });
 }
 const allowedPropIds = caller.propertyIds?.length
   ? caller.propertyIds
   : caller.propertyId
   ? [caller.propertyId]
   : [];
 let propList = checked(properties);
 let ruleList = checked(rules);
 if (!callerIsSuperAdmin) {
   propList = propList.filter((p: any) => allowedPropIds.includes(p.id));
   ruleList = ruleList.filter((r: any) => !r.property_id || allowedPropIds.includes(r.property_id));
 }
 return NextResponse.json({success:true,rules:ruleList,properties:propList,team:team.map(p=>({...p,isAdmin:active.some(m=>m.user_id===p.id&&["owner","admin"].includes(m.role))}))},{headers:{"Cache-Control":"no-store"}});
});
export const POST=withWorkspace(async(request:NextRequest)=>{
 requireManageRoleMapping();const b=await request.json(),caller=workspaceUser();
 const callerIsSuperAdmin=caller.isOrganizationAdmin||caller.orgRole==="super_admin"||(caller.rights||[]).includes("org_role:super_admin");
 if(!callerIsSuperAdmin){
  const allowedPropIds = caller.propertyIds?.length ? caller.propertyIds : (caller.propertyId ? [caller.propertyId] : []);
  if(!b.property_id || !allowedPropIds.includes(b.property_id)){
   throw new PlatformError("Hotel administrators can only configure escalation rules for their assigned property.", 403);
  }
 }
 if(b.escalate_until&&!["acknowledged","resolved"].includes(b.escalate_until))throw new PlatformError("Choose a valid escalation stop condition.");
 if(!["feedback","hospitality"].includes(b.module))throw new PlatformError("Choose a valid module.");
 const row={organization_id:workspaceUser().organizationId,module:b.module,property_id:b.property_id||null,country:text(b.country,"Country",100,false),department:text(b.department||"*","Department",60),role_name:text(b.role_name,"Role name",80),assignee_id:text(b.assignee_id,"Assignee",50),max_rating:number(b.max_rating??3,"Attention rating",1,3),senior_assignee_id:b.senior_assignee_id||null,gm_assignee_id:b.gm_assignee_id||null,response_minutes:number(b.response_minutes??15,"Junior response minutes",1,1440),senior_response_minutes:number(b.senior_response_minutes??20,"Senior response minutes",1,1440),escalate_until:b.escalate_until||"acknowledged"};
 const query=workspaceDb().from("role_mappings");
 const result=await (request.method==="PATCH"?query.update(row).eq("id",text(b.id,"Mapping",50)).eq("organization_id",workspaceUser().organizationId):query.insert(row)).select("id").single();
 if(result.error?.code==="23505")throw new PlatformError("A rule already exists for this module, scope and department. Edit the existing rule instead.",409);
 return NextResponse.json({success:true,rule:checked(result)},{status:request.method==="PATCH"?200:201});
});
export const PATCH=POST;
export const DELETE=withWorkspace(async(request:NextRequest)=>{
 requireManageRoleMapping();const b=await request.json(),caller=workspaceUser();
 const callerIsSuperAdmin=caller.isOrganizationAdmin||caller.orgRole==="super_admin"||(caller.rights||[]).includes("org_role:super_admin");
 if(!callerIsSuperAdmin){
  const allowedPropIds = caller.propertyIds?.length ? caller.propertyIds : (caller.propertyId ? [caller.propertyId] : []);
  const targetRule = checked(await workspaceDb().from("role_mappings").select("property_id").eq("organization_id", caller.organizationId).eq("id", text(b.id, "Mapping", 50)).single());
  if(targetRule?.property_id && !allowedPropIds.includes(targetRule.property_id)){
   throw new PlatformError("You are not authorized to delete rules outside your assigned property.", 403);
  }
 }
 if(b.escalate_until&&!["acknowledged","resolved"].includes(b.escalate_until))throw new PlatformError("Choose a valid escalation stop condition.");checked(await workspaceDb().from("role_mappings").delete().eq("organization_id",workspaceUser().organizationId).eq("id",text(b.id,"Mapping",50)).select("id").single());
 return NextResponse.json({success:true});
});
