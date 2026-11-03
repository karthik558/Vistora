import {NextRequest,NextResponse} from "next/server";
import {withWorkspace,text,email} from "../../../lib/platform/http";
import {checked,workspaceDb,serviceDb,workspaceUser,assertProperty,PlatformError} from "../../../lib/platform/db";
import {withModuleAssignments} from "../../../lib/auth/modules";
const roles=["super_admin","admin","general_manager","department_head","executive","front_office_staff","feedback","analyst","report","staff","visitor"];
async function moduleSchemaReady(){
 const caller = workspaceUser();
 const callerIsSuperAdmin = caller.isOrganizationAdmin || caller.orgRole === "super_admin" || (caller.rights || []).includes("org_role:super_admin");
 const canManage = callerIsSuperAdmin || caller.rights?.includes("manage_users");
 if(!canManage)throw new PlatformError("Team management permission required.",403);
 const result=await workspaceDb().rpc("workspace_module",{module:"feedback"});
 if(result.error&&["PGRST202","42883"].includes(result.error.code))throw new PlatformError("Module permission setup is pending. Apply section 25 in supabase/schema.sql before saving member access.",503);
 checked({data:true,error:result.error});
}
async function applyMember(id:string,b:any,address:string,name:string) {
 const user=workspaceUser();
 const callerIsSuperAdmin = user.isOrganizationAdmin || user.orgRole === "super_admin" || (user.rights || []).includes("org_role:super_admin");
 const canManage = callerIsSuperAdmin || user.rights?.includes("manage_users");
 if(!canManage)throw new PlatformError("Team management permission required.",403);
 const role=roles.includes(b.role)?b.role:"staff";
 if(role === "super_admin" && !callerIsSuperAdmin) {
   throw new PlatformError("Only super administrators can assign the Super Admin role.", 403);
 }
 const properties=Array.isArray(b.propertyIds)?b.propertyIds:b.propertyId?[b.propertyId]:[];
 if(properties.length>100)throw new PlatformError("Too many properties.");
 if(!callerIsSuperAdmin) {
   const callerAllowed = user.propertyIds?.length ? user.propertyIds : (user.propertyId ? [user.propertyId] : []);
   if (callerAllowed.length > 0) {
     for (const p of properties) {
       if (!callerAllowed.includes(p)) {
         throw new PlatformError("You can only assign members to properties within your authorized scope.", 403);
       }
     }
   }
 }
 for(const property of properties)await assertProperty(property);
 const rights=withModuleAssignments(Array.isArray(b.rights)?b.rights.filter((r:unknown)=>typeof r==="string"&&r.length<100&&!r.startsWith("org_role:")).slice(0,50):["view_feedback"]);
 rights.push("org_role:"+role);
 const target=await serviceDb().from("organization_members").select("role,organization_id").eq("user_id",id).maybeSingle();
 if(target.data?.organization_id&&target.data.organization_id!==user.organizationId)throw new PlatformError("Account belongs to another company.",403);
 if(target.data?.role==="owner")throw new PlatformError("The company owner cannot be modified here.",403);
 if(!callerIsSuperAdmin && target.data) {
   const targetProfile = await workspaceDb().from("profiles").select("role, rights").eq("id", id).maybeSingle();
   const tRights = Array.isArray(targetProfile.data?.rights) ? targetProfile.data.rights : [];
   if (targetProfile.data?.role === "super_admin" || tRights.includes("org_role:super_admin")) {
     throw new PlatformError("You cannot modify super administrator accounts.", 403);
   }
 }
 const isSuperAdminUser = role === "super_admin";
 const provision = await serviceDb().rpc("provision_workspace_user",{p_user:id,p_org:user.organizationId,p_email:address,p_name:name,p_admin:isSuperAdminUser,p_properties:properties,p_rights:rights});
 checked({data:true,error:provision.error});
 return checked(await workspaceDb().from("profiles").select("*,properties(id,name,code)").eq("id",id).single());
}
export const GET=withWorkspace(async()=>{
 const caller = workspaceUser();
 const callerIsSuperAdmin = caller.isOrganizationAdmin || caller.orgRole === "super_admin" || (caller.rights || []).includes("org_role:super_admin");
 const members=checked(await workspaceDb().from("organization_members").select("user_id, role").eq("is_active",true));
 if(!members.length) return NextResponse.json({success:true, users:[]});

 let users=checked(await workspaceDb().from("profiles").select("*,properties(id,name,code)").in("id",members.map(m=>m.user_id)).order("created_at",{ascending:false}));

 if (!callerIsSuperAdmin) {
   const ownerMemberIds = new Set(members.filter(m => m.role === "owner").map(m => m.user_id));
   const callerAllowed = caller.propertyIds?.length ? caller.propertyIds : (caller.propertyId ? [caller.propertyId] : []);
   users = users.filter((u: any) => {
     if (ownerMemberIds.has(u.id)) return false;
     if (u.role === "super_admin") return false;
     const rights = Array.isArray(u.rights) ? u.rights : [];
     if (rights.includes("org_role:super_admin")) return false;
     if (callerAllowed.length > 0 && u.id !== caller.id) {
       const uProps: string[] = Array.isArray(u.property_ids) && u.property_ids.length > 0
         ? u.property_ids
         : (u.property_id ? [u.property_id] : []);
       if (uProps.length > 0 && !uProps.some(p => callerAllowed.includes(p))) {
         return false;
       }
     }
     return true;
   });
 }
 return NextResponse.json({success:true,users});
});
export const POST=withWorkspace(async(request:NextRequest)=>{
 const caller = workspaceUser();
 const callerIsSuperAdmin = caller.isOrganizationAdmin || caller.orgRole === "super_admin" || (caller.rights || []).includes("org_role:super_admin");
 const canManage = callerIsSuperAdmin || caller.rights?.includes("manage_users");
 if(!canManage)throw new PlatformError("Team management permission required.",403);
 const b=await request.json(),address=email(b.email),name=text(b.fullName,"Name",100);
 if(b.role === "super_admin" && !callerIsSuperAdmin) {
   throw new PlatformError("Only super administrators can assign the Super Admin role.", 403);
 }
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
 const caller = workspaceUser();
 const callerIsSuperAdmin = caller.isOrganizationAdmin || caller.orgRole === "super_admin" || (caller.rights || []).includes("org_role:super_admin");
 const b=await request.json(),current=checked(await workspaceDb().from("profiles").select("*").eq("id",b.userId).single());
 const currentRights = Array.isArray(current.rights) ? current.rights : [];
 if((current.role === "super_admin" || currentRights.includes("org_role:super_admin")) && !callerIsSuperAdmin) {
   throw new PlatformError("You cannot modify super administrator accounts.", 403);
 }
 const user=await applyMember(current.id,{...b,role:b.role||currentRights.find((r:string)=>r.startsWith("org_role:"))?.slice(9)||current.role,propertyIds:b.propertyIds||current.property_ids,rights:b.rights||current.rights},current.email,b.fullName?text(b.fullName,"Name",100):current.full_name);
 return NextResponse.json({success:true,user});
},"manage_users");
