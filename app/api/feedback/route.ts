import { publicQuestions } from "../../../lib/feedback/questionnaires";
import {validateAnswers} from "../../../lib/feedbackAnswers";
import { NextRequest, NextResponse } from "next/server";
import { fetchFeedbackList,createFeedback,deleteFeedback,updateFeedbackProperty,invalidateDashboardCache } from "../../../lib/services/guestExperienceService";
import { readJson, withWorkspace,errorResponse,text,number,email } from "../../../lib/platform/http";
import { checked,serviceDb,workspaceDb,workspaceUser,assertProperty,PlatformError } from "../../../lib/platform/db";
import { resolvePublicFeedbackLink } from "../../../lib/feedback/public-links";
import { logAuditEvent } from "../../../lib/services/auditLogService";
import {queueGuestMessage} from "../../../lib/services/guestMessaging";
export const GET=withWorkspace(async(request:NextRequest)=>{
  const params=request.nextUrl.searchParams;
  const list=await fetchFeedbackList({propertyId:params.get("propertyId")||undefined,status:(params.get("status")||"all") as any,search:params.get("search")||undefined});
  return NextResponse.json({success:true,data:list});
},"view_feedback");
export async function POST(request:NextRequest) {
 try {
  const body=await readJson(request);
  const { db, property, invitation, stay, details, questionnaire } = await resolvePublicFeedbackLink(body.publicToken);
  if (details.demo) throw new PlatformError("Preview links cannot save feedback.", 403);
  if (body.propertyId !== undefined && body.propertyId !== property.id) throw new PlatformError("This link belongs to another property.", 403);
  const rating=number(body.rating,"Rating",1,5);
  const departments=["Front Desk","Housekeeping","Food & Beverage","Concierge","Facilities & Room","Spa & Wellness","Valet & Transfers"];
  if(!departments.includes(body.department))throw new PlatformError("Choose a valid department.");
  const invitationId = invitation?.id;
  const stayId = stay?.id;
  const questions=await publicQuestions(db,property,questionnaire);
  const relevant=questions.filter(q=>!q.department||q.department===body.department);
  let validated;
  try {validated=validateAnswers(relevant,body.answers,body.recommendationScore);}catch(error){throw new PlatformError(error instanceof Error?error.message:"Invalid answers.");}
  const finalGuestName = text(details.guestName || body.guestName || "Guest", "Name", 100);
  const finalRoomNumber = text(details.roomNumber || body.roomNumber || "Guest", "Room", 50);
  const finalGuestEmail = (body.guestEmail || invitation?.guest_email) ? email(body.guestEmail || invitation?.guest_email) : undefined;
  const finalGuestPhone = (body.guestPhone || invitation?.guest_phone) ? text(body.guestPhone || invitation?.guest_phone, "Phone", 30) : undefined;
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
  invalidateDashboardCache();
  try { await logAuditEvent({organizationId:property.organization_id,actorName:"Guest",actorEmail:"guest@vistora.app",actorRole:"guest",action:"Guest feedback submitted",resource:created.id,details:"Rating: "+rating}); } catch { console.error("Could not record the guest feedback audit event."); }
  return NextResponse.json({success:true,id:created.id},{status:201,headers:{"Cache-Control":"no-store"}});
 } catch(error){return errorResponse(error);}
}
export const PATCH=withWorkspace(async(request:NextRequest)=>{
 const body=await readJson(request);await assertProperty(body.propertyId);
 checked(await workspaceDb().from("feedback").select("id").eq("id",body.id).single());
 await updateFeedbackProperty(body.id,body.propertyId);
 return NextResponse.json({success:true});
},"manage_complaints");
export const DELETE=withWorkspace(async(request:NextRequest)=>{
 if(!workspaceUser().isOrganizationAdmin)throw new PlatformError("Administrator access required.",403);
 const body=await readJson(request),ids=Array.isArray(body.ids)?body.ids:[body.id];
 if(!ids.length||ids.length>100)throw new PlatformError("Select 1–100 records.");
 const visible=checked(await workspaceDb().from("feedback").select("id").in("id",ids));
 if(visible.length!==ids.length)throw new PlatformError("One or more records are unavailable.",404);
 return NextResponse.json({success:true,...await deleteFeedback(ids)});
});
