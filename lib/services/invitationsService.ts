import { checked, PlatformError, serviceDb, workspaceDb, workspaceUser, assertProperty } from "../platform/db";
import { newToken, hashToken, encryptSecret, decryptSecret } from "../platform/secrets";
export interface GuestInvitation { id:string;token:string;guestName:string;guestEmail?:string|null;guestPhone?:string|null;propertyId:string;propertyName?:string;roomNumber:string;channel:"direct_link"|"email"|"sms"|"whatsapp";status:"pending"|"completed"|"expired";createdAt:string;completedAt?:string|null;feedbackRating?:number|null;feedbackId?:string|null;notes?:string|null; }
function map(r:any,token=""):GuestInvitation {return {id:r.id,token,guestName:r.guest_name,guestEmail:r.guest_email,guestPhone:r.guest_phone,propertyId:r.property_id,propertyName:r.properties?.name,roomNumber:r.room_number,channel:r.channel,status:r.status==="pending"&&Date.parse(r.expires_at)<Date.now()?"expired":r.status,createdAt:r.created_at,completedAt:r.completed_at,feedbackRating:r.feedback_rating,feedbackId:r.feedback_id,notes:r.notes};}
export async function listInvitations(propertyId?:string) {
  let q=workspaceDb().from("guest_invitations").select("*,properties(name)").order("created_at",{ascending:false});
  if(propertyId&&propertyId!=="all")q=q.eq("property_id",propertyId);
  return checked(await q).map((r:any)=>map(r,r.token_encrypted?decryptSecret(r.token_encrypted):""));
}
export async function createInvitation(payload:{guestName:string;guestEmail?:string;guestPhone?:string;propertyId:string;propertyName?:string;roomNumber:string;channel?:"direct_link"|"email"|"sms"|"whatsapp";notes?:string;}) {
  await assertProperty(payload.propertyId);
  const token=newToken(),org=workspaceUser().organizationId,db=workspaceDb();
  const row=checked(await serviceDb().rpc("create_guest_invitation",{p_invitation:{organization_id:org,property_id:payload.propertyId,token_encrypted:encryptSecret(token),guest_name:payload.guestName,guest_email:payload.guestEmail||null,guest_phone:payload.guestPhone||null,room_number:payload.roomNumber,channel:payload.channel||"direct_link",notes:payload.notes||null},p_token:token}));
  return map(row,token);
}
export async function getInvitationByToken(token:string) {
  const {data,error}=await serviceDb().from("guest_invitations").select("*,properties(name)").eq("token_hash",hashToken(token)).eq("status","pending").gt("expires_at",new Date().toISOString()).maybeSingle();
  if(error)checked({data,error});
  return data?map(data,token):null;
}
export async function markInvitationCompleted(_token:string,_rating:number,_feedbackId?:string) { /* Transactional feedback trigger handles this. */ return true; }
export async function deleteInvitation(id:string) {
  checked(await workspaceDb().from("guest_invitations").delete().eq("id",id).select("id").single());
  return true;
}
