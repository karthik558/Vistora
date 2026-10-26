import { NextRequest, NextResponse } from "next/server";
import { fetchFeedbackList,createFeedback,deleteFeedback,updateFeedbackProperty,invalidateDashboardCache } from "../../../lib/services/guestExperienceService";
import { withWorkspace,errorResponse,text,number } from "../../../lib/platform/http";
import { checked,serviceDb,workspaceDb,workspaceUser,assertProperty,PlatformError } from "../../../lib/platform/db";
import { hashToken } from "../../../lib/platform/secrets";
import { logAuditEvent } from "../../../lib/services/auditLogService";
export const GET=withWorkspace(async(request:NextRequest)=>{
  const params=request.nextUrl.searchParams;
  const list=await fetchFeedbackList({propertyId:params.get("propertyId")||undefined,status:(params.get("status")||"all") as any,search:params.get("search")||undefined});
  return NextResponse.json({success:true,data:list});
},"view_feedback");
export async function POST(request:NextRequest) {
 try {
  const body=await request.json(), db=serviceDb();
  const property=checked(await db.from("properties").select("id,organization_id,is_active,organizations(is_demo)").eq("id",body.propertyId).eq("is_active",true).maybeSingle());
  const rating=number(body.rating,"Rating",1,5);
  const departments=["Front Desk","Housekeeping","Food & Beverage","Concierge","Facilities & Room","Spa & Wellness","Valet & Transfers"];
  if(!departments.includes(body.department))throw new PlatformError("Choose a valid department.");
  let invitationId:string|undefined;
  if(body.publicToken&&body.publicToken!=="verified") {
    const token=text(body.publicToken,"Invitation",200);
    const {data:inv,error}=await db.from("guest_invitations").select("id,property_id,status,expires_at").eq("token_hash",hashToken(token)).maybeSingle();
    if(error)checked({data:inv,error});
    if(inv) {
      if(inv.property_id!==property.id||inv.status!=="pending"||Date.parse(inv.expires_at)<=Date.now())throw new PlatformError("This invitation has expired or was already used.",410);
      invitationId=inv.id;
    } else {
      const {data:stay}=await db.from("stays").select("id").eq("public_token",token).eq("property_id",property.id).eq("status","active").maybeSingle();
      if(!stay)throw new PlatformError("Invitation not found.",404);
    }
  }
  const questions=checked(await db.from("feedback_questions").select("id,question_text,question_type,is_required,department,options").eq("organization_id",property.organization_id).eq("is_active",true).or("property_id.is.null,property_id.eq."+property.id));
  const relevant=questions.filter(q=>!q.department||q.department===body.department);
  const answers:Array<{questionId:string;questionText:string;answerValue:string}>=Array.isArray(body.answers)?body.answers.slice(0,80).map((a:any)=>{
   const question=relevant.find(q=>q.id===a.questionId);if(!question)throw new PlatformError("This questionnaire changed. Reload the form and try again.");
   const value=text(a.answerValue,"Answer",2000,false);
   if(["nps","csat"].includes(question.question_type)&&(!/^\d+$/.test(value)||Number(value)<(question.question_type==="nps"?0:1)||Number(value)>10))throw new PlatformError("Choose a valid recommendation or satisfaction score.");
   return {questionId:question.id,questionText:question.question_text,answerValue:value};
  }):[];
  if(relevant.some(q=>q.is_required&&!answers.some(a=>a.questionId===q.id&&a.answerValue)))throw new PlatformError("Please answer the required questions.");
  const npsQuestion=relevant.find(q=>q.question_type==="nps"),npsAnswer=answers.find(a=>a.questionId===npsQuestion?.id)?.answerValue;
  const created=await createFeedback({
    organizationId:property.organization_id,propertyId:property.id,invitationId,rating,department:body.department,
    guestName:text(body.guestName||"Guest","Name",100),roomNumber:text(body.roomNumber||"Guest","Room",50),
    comment:text(body.comment,"Comment",4000,false),guestEmail:body.guestEmail?text(body.guestEmail,"Email",254):undefined,
    guestPhone:body.guestPhone?text(body.guestPhone,"Phone",30):undefined,wantsContact:body.wantsContact===true,
    contactPreference:["email","phone","in_person"].includes(body.contactPreference)?body.contactPreference:undefined,
    recommendationScore:body.recommendationScore===null||body.recommendationScore===undefined?(npsAnswer?Number(npsAnswer):null):number(body.recommendationScore,"Recommendation score",0,10),answers
  });
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
