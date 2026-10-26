import {NextRequest,NextResponse} from "next/server";
import {withWorkspace,text,email} from "../../../lib/platform/http";
import {checked,workspaceDb,serviceDb,workspaceUser,assertProperty,PlatformError} from "../../../lib/platform/db";
import {withModuleAssignments} from "../../../lib/auth/modules";
const roles=["super_admin","admin","general_manager","department_head","executive","front_office_staff","feedback","analyst","report","staff","visitor"];
async function moduleSchemaReady(){
 if(!workspaceUser().isOrganizationAdmin)throw new PlatformError("Workspace administrator required.",403);
 const result=await workspaceDb().rpc("workspace_module",{module:"feedback"});
 if(result.error&&["PGRST202","42883"].includes(result.error.code))throw new PlatformError("Module permission setup is pending. Apply section 25 in supabase/schema.sql before saving member access.",503);
 checked({data:true,error:result.error});
}
async function applyMember(id:string,b:any,address:string,name:string) {
 const user=workspaceUser();if(!user.isOrganizationAdmin)throw new PlatformError("Workspace administrator required.",403);
 const role=roles.includes(b.role)?b.role:"staff";
 const properties=Array.isArray(b.propertyIds)?b.propertyIds:b.propertyId?[b.propertyId]:[];
 if(properties.length>100)throw new PlatformError("Too many properties.");
 for(const property of properties)await assertProperty(property);
 const rights=withModuleAssignments(Array.isArray(b.rights)?b.rights.filter((r:unknown)=>typeof r==="string"&&r.length<100&&!r.startsWith("org_role:")).slice(0,50):["view_feedback"]);
 rights.push("org_role:"+role);
 const target=await serviceDb().from("organization_members").select("role,organization_id").eq("user_id",id).maybeSingle();
 if(target.data?.organization_id&&target.data.organization_id!==user.organizationId)throw new PlatformError("Account belongs to another company.",403);
 if(target.data?.role==="owner")throw new PlatformError("The company owner cannot be modified here.",403);
 const provision = await serviceDb().rpc("provision_workspace_user",{p_user:id,p_org:user.organizationId,p_email:address,p_name:name,p_admin:role==="admin"||role==="super_admin",p_properties:properties,p_rights:rights});
 checked({data:true,error:provision.error});
 return checked(await workspaceDb().from("profiles").select("*,properties(id,name,code)").eq("id",id).single());
}
export const GET=withWorkspace(async()=>{
 const members=checked(await workspaceDb().from("organization_members").select("user_id").eq("is_active",true));
 const users=members.length?checked(await workspaceDb().from("profiles").select("*,properties(id,name,code)").in("id",members.map(m=>m.user_id)).order("created_at",{ascending:false})):[];
 return NextResponse.json({success:true,users});
});
export const POST=withWorkspace(async(request:NextRequest)=>{
 if(!workspaceUser().isOrganizationAdmin)throw new PlatformError("Workspace administrator required.",403);
 const b=await request.json(),address=email(b.email),name=text(b.fullName,"Name",100);
 if(typeof b.password!=="string"||b.password.length<10)throw new PlatformError("Use a password of at least 10 characters.");
 await moduleSchemaReady();
 const db=serviceDb();
 const auth=await db.auth.admin.createUser({email:address,password:b.password,email_confirm:true,user_metadata:{full_name:name}});
 if(auth.error||!auth.data.user)throw new PlatformError(auth.error?.message||"Cannot create account.");
 try {const user=await applyMember(auth.data.user.id,b,address,name);return NextResponse.json({success:true,user},{status:201});}
 catch(error){await db.auth.admin.deleteUser(auth.data.user.id);throw error;}
},"manage_users");
export const PATCH=withWorkspace(async(request:NextRequest)=>{
 await moduleSchemaReady();
 const b=await request.json(),current=checked(await workspaceDb().from("profiles").select("*").eq("id",b.userId).single());
 const user=await applyMember(current.id,{...b,role:b.role||current.rights?.find((r:string)=>r.startsWith("org_role:"))?.slice(9)||current.role,propertyIds:b.propertyIds||current.property_ids,rights:b.rights||current.rights},current.email,b.fullName?text(b.fullName,"Name",100):current.full_name);
 return NextResponse.json({success:true,user});
},"manage_users");
