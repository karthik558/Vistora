import {validateAnswers} from "../../../lib/feedbackAnswers";
import { NextRequest, NextResponse } from "next/server";
import { fetchFeedbackList,createFeedback,deleteFeedback,updateFeedbackProperty,invalidateDashboardCache } from "../../../lib/services/guestExperienceService";
import { withWorkspace,errorResponse,text,number } from "../../../lib/platform/http";
import { checked,serviceDb,workspaceDb,workspaceUser,assertProperty,PlatformError } from "../../../lib/platform/db";
import { hashToken } from "../../../lib/platform/secrets";
import { logAuditEvent } from "../../../lib/services/auditLogService";
import {queueGuestMessage} from "../../../lib/services/guestMessaging";
export const GET=withWorkspace(async(request:NextRequest)=>{
  const params=request.nextUrl.searchParams;
  const list=await fetchFeedbackList({propertyId:params.get("propertyId")||undefined,status:(params.get("status")||"all") as any,search:params.get("search")||undefined});
  return NextResponse.json({success:true,data:list});
},"view_feedback");
export async function POST(request:NextRequest) {
 try {
  const body=await request.json(), db=serviceDb();
   const property=checked(await db.from("properties").select("id,name,organization_id,is_active,organizations(is_demo)").eq("id",body.propertyId).eq("is_active",true).maybeSingle());
  const rating=number(body.rating,"Rating",1,5);
  const departments=["Front Desk","Housekeeping","Food & Beverage","Concierge","Facilities & Room","Spa & Wellness","Valet & Transfers"];
  if(!departments.includes(body.department))throw new PlatformError("Choose a valid department.");
  let invitationId:string|undefined;
  let stayId:string|undefined;
  let stayRoom:string|undefined;
  let stayGuest:string|undefined;
  let invGuest:string|undefined;
  let invRoom:string|undefined;
  let invEmail:string|undefined;
  let invPhone:string|undefined;
  if(body.publicToken&&body.publicToken!=="verified") {
    const token=text(body.publicToken,"Invitation",200);
    const {data:inv,error}=await db.from("guest_invitations").select("id,property_id,status,expires_at,guest_name,room_number,guest_email,guest_phone").eq("token_hash",hashToken(token)).maybeSingle();
    if(error)checked({data:inv,error});
    if(inv) {
      if(inv.property_id!==property.id||inv.status!=="pending"||Date.parse(inv.expires_at)<=Date.now())throw new PlatformError("This invitation has expired or was already used.",410);
      invitationId=inv.id;
      invGuest=inv.guest_name;
      invRoom=inv.room_number;
      invEmail=inv.guest_email;
      invPhone=inv.guest_phone;
    } else {
      const {data:stay,error:stayError}=await db.from("stays").select("id,room_number,guests(full_name)").eq("public_token",token).eq("property_id",property.id).eq("status","active").maybeSingle();
      if(stayError)checked({data:stay,error:stayError});
      if(!stay)throw new PlatformError("Invitation not found.",404);
      stayId=stay.id;
      stayRoom=stay.room_number;
      const guest=Array.isArray(stay.guests)?stay.guests[0]:stay.guests;
      stayGuest=guest?.full_name;
    }
  }
  const questions=checked(await db.from("feedback_questions").select("id,question_text,question_type,is_required,department,options").eq("organization_id",property.organization_id).eq("is_active",true).or("property_id.is.null,property_id.eq."+property.id));
  const relevant=questions.filter(q=>!q.department||q.department===body.department);
  let validated;
  try {validated=validateAnswers(relevant,body.answers,body.recommendationScore);}catch(error){throw new PlatformError(error instanceof Error?error.message:"Invalid answers.");}
  const finalGuestName = text(stayGuest || body.guestName || invGuest || "Guest", "Name", 100);
  const finalRoomNumber = text(stayRoom || body.roomNumber || invRoom || "Guest", "Room", 50);
  const finalGuestEmail = (body.guestEmail || invEmail) ? text(body.guestEmail || invEmail, "Email", 254) : undefined;
  const finalGuestPhone = (body.guestPhone || invPhone) ? text(body.guestPhone || invPhone, "Phone", 30) : undefined;
  const created=await createFeedback({
    organizationId:property.organization_id,propertyId:property.id,invitationId,stayId,rating,department:body.department,
    guestName:finalGuestName,roomNumber:finalRoomNumber,
    comment:text(body.comment,"Comment",4000,false),guestEmail:finalGuestEmail,
    guestPhone:finalGuestPhone,wantsContact:body.wantsContact===true,
    contactPreference:["email","phone","in_person"].includes(body.contactPreference)?body.contactPreference:undefined,
    ...validated
  });
   try{await queueGuestMessage({organizationId:property.organization_id,propertyId:property.id,feedbackId:created.id,guestName:finalGuestName,guestEmail:finalGuestEmail,propertyName:property.name,trigger:"feedback_received",rating});}
   catch(error){console.error("Could not queue guest acknowledgement:",error);}
  if(invitationId) {
    try {
      await db.from("guest_invitations").update({
        status: "completed",
        completed_at: new Date().toISOString(),
        feedback_rating: rating,
        feedback_id: created.id,
      }).eq("id", invitationId);
    } catch(e) {
      console.warn("Failed to mark invitation as completed:", e);
    }
  }
  invalidateDashboardCache();
  await logAuditEvent({organizationId:property.organization_id,actorName:"Guest",actorEmail:"guest@vistora.app",actorRole:"guest",action:"Guest feedback submitted",resource:created.id,details:"Rating: "+rating});
  return NextResponse.json({success:true,data:created},{status:201});
 } catch(error){return errorResponse(error);}
}
export const PATCH=withWorkspace(async(request:NextRequest)=>{
 const body=await request.json();await assertProperty(body.propertyId);
 checked(await workspaceDb().from("feedback").select("id").eq("id",body.id).single());
 await updateFeedbackProperty(body.id,body.propertyId);
 return NextResponse.json({success:true});
},"manage_complaints");
export const DELETE=withWorkspace(async(request:NextRequest)=>{
 if(!workspaceUser().isOrganizationAdmin)throw new PlatformError("Administrator access required.",403);
 const body=await request.json(),ids=Array.isArray(body.ids)?body.ids:[body.id];
 if(!ids.length||ids.length>100)throw new PlatformError("Select 1–100 records.");
 const visible=checked(await workspaceDb().from("feedback").select("id").in("id",ids));
 if(visible.length!==ids.length)throw new PlatformError("One or more records are unavailable.",404);
 return NextResponse.json({success:true,...await deleteFeedback(ids)});
});
