import {NextRequest,NextResponse} from "next/server";
import {withWorkspace} from "../../../../lib/platform/http";
import {checked,serviceDb,workspaceDb,workspaceUser,PlatformError} from "../../../../lib/platform/db";
export const DELETE=withWorkspace(async(_request:NextRequest,{params}:{params:Promise<{id:string}>})=>{
 const user=workspaceUser(),{id}=await params;if(!user.isOrganizationAdmin||user.id===id)throw new PlatformError("You cannot remove this account.",403);
 checked(await workspaceDb().from("profiles").select("id").eq("id",id).single());
 const member=checked(await serviceDb().from("organization_members").select("*").eq("user_id",id).eq("organization_id",user.organizationId).single());
 if(member.role==="owner")throw new PlatformError("Company owner access cannot be revoked.",403);
 checked(await serviceDb().from("organization_members").update({is_active:false}).eq("user_id",id).eq("organization_id",user.organizationId).select().single());
 return NextResponse.json({success:true,message:"Workspace access revoked. Historical records are preserved."});
},"manage_users");
