import {NextRequest,NextResponse} from "next/server";
import {withWorkspace} from "../../../../lib/platform/http";
import {checked,serviceDb,workspaceDb,workspaceUser,PlatformError} from "../../../../lib/platform/db";
export const DELETE=withWorkspace(async(_request:NextRequest,{params}:{params:Promise<{id:string}>})=>{
 const user=workspaceUser(),{id}=await params;
 const callerIsSuperAdmin = user.isOrganizationAdmin || user.orgRole === "super_admin" || (user.rights || []).includes("org_role:super_admin");
 const canManage = callerIsSuperAdmin || user.rights?.includes("manage_users");
 if(!canManage || user.id===id)throw new PlatformError("You cannot remove this account.",403);
 const targetProfile = checked(await workspaceDb().from("profiles").select("id, role, rights").eq("id",id).single());
 const targetRights = Array.isArray(targetProfile.rights) ? targetProfile.rights : [];
 if((targetProfile.role === "super_admin" || targetRights.includes("org_role:super_admin")) && !callerIsSuperAdmin) {
  throw new PlatformError("You cannot remove super administrator accounts.", 403);
 }
 const member=checked(await serviceDb().from("organization_members").select("*").eq("user_id",id).eq("organization_id",user.organizationId).single());
 if(member.role==="owner")throw new PlatformError("Company owner access cannot be revoked.",403);
 checked(await serviceDb().from("organization_members").update({is_active:false}).eq("user_id",id).eq("organization_id",user.organizationId).select().single());
 return NextResponse.json({success:true,message:"Workspace access revoked. Historical records are preserved."});
},"manage_users");
