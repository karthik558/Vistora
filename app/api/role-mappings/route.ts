import {NextRequest,NextResponse} from "next/server";
import {withWorkspace,text,number} from "../../../lib/platform/http";
import {checked,workspaceDb,workspaceUser,PlatformError} from "../../../lib/platform/db";
function admin(){if(!workspaceUser().isOrganizationAdmin)throw new PlatformError("Company administrator access required.",403);}
export const GET=withWorkspace(async()=>{
 admin();const db=workspaceDb(),org=workspaceUser().organizationId;
 const [rules,properties,members]=await Promise.all([
  db.from("role_mappings").select("*").eq("organization_id",org).order("created_at"),
  db.from("properties").select("id,name,country,is_active").eq("organization_id",org).order("name"),
  db.from("organization_members").select("user_id,role").eq("organization_id",org).eq("is_active",true)
 ]);
 if(rules.error&&["42P01","PGRST205"].includes(rules.error.code))throw new PlatformError("Role mapping setup is pending. Apply supabase/migrations/20261027_role_mapping.sql after schema sections 12–25.",503);
 const active=checked(members),team=active.length?checked(await db.from("profiles").select("id,full_name,email,property_id,property_ids,rights").eq("organization_id",org).in("id",active.map(m=>m.user_id))):[];
 return NextResponse.json({success:true,rules:checked(rules),properties:checked(properties),team:team.map(p=>({...p,isAdmin:active.some(m=>m.user_id===p.id&&["owner","admin"].includes(m.role))}))},{headers:{"Cache-Control":"no-store"}});
});
export const POST=withWorkspace(async(request:NextRequest)=>{
 admin();const b=await request.json();
 if(!["feedback","hospitality"].includes(b.module))throw new PlatformError("Choose a valid module.");
 const row={organization_id:workspaceUser().organizationId,module:b.module,property_id:b.property_id||null,country:text(b.country,"Country",100,false),department:text(b.department||"*","Department",60),role_name:text(b.role_name,"Role name",80),assignee_id:text(b.assignee_id,"Assignee",50),max_rating:number(b.max_rating??3,"Attention rating",1,3)};
 const query=workspaceDb().from("role_mappings");
 const result=await (request.method==="PATCH"?query.update(row).eq("id",text(b.id,"Mapping",50)).eq("organization_id",workspaceUser().organizationId):query.insert(row)).select("id").single();
 if(result.error?.code==="23505")throw new PlatformError("A rule already exists for this module, scope and department. Edit the existing rule instead.",409);
 return NextResponse.json({success:true,rule:checked(result)},{status:request.method==="PATCH"?200:201});
});
export const PATCH=POST;
export const DELETE=withWorkspace(async(request:NextRequest)=>{
 admin();const b=await request.json();checked(await workspaceDb().from("role_mappings").delete().eq("organization_id",workspaceUser().organizationId).eq("id",text(b.id,"Mapping",50)).select("id").single());
 return NextResponse.json({success:true});
});
