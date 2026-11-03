import {NextRequest,NextResponse} from "next/server";
import { readJson,withWorkspace,text,errorResponse} from "../../../lib/platform/http";
import {checked,workspaceDb,serviceDb,workspaceUser,PlatformError,assertProperty} from "../../../lib/platform/db";
import { resolvePublicFeedbackLink } from "../../../lib/feedback/public-links";
import { publicQuestions } from "../../../lib/feedback/questionnaires";
import { questionFields } from "../../../lib/feedback/question-fields";
export interface FeedbackQuestion {id:string;property_id?:string|null;question_text:string;question_type:string;options?:string[];department?:string|null;translations?:Record<string,{questionText?:string;options?:string[]}>;is_required:boolean;display_order:number;is_active:boolean;created_at?:string;}
export async function GET(request:NextRequest) {
 const read=withWorkspace(async(req:NextRequest)=>{
  const id=req.nextUrl.searchParams.get("propertyId"),form=req.nextUrl.searchParams.get("questionnaireId");
  if(id)await assertProperty(id);
  const query=(legacySchema=false)=>{
   let q=workspaceDb().from("feedback_questions").select("*").order("display_order");
   if(req.nextUrl.searchParams.get("all")!=="true")q=q.eq("is_active",true);
   if(id)q=form?q.eq("property_id",id):q.or("property_id.is.null,property_id.eq."+id);
   return form?q.eq("questionnaire_id",form):legacySchema?q:q.is("questionnaire_id",null);
  };
  let result=await query();
  if(!form&&result.error&&["PGRST204","42703"].includes(result.error.code))result=await query(true);
  return NextResponse.json({success:true,questions:checked(result),synced:true});
 },"manage_questionnaire");
 if(request.nextUrl.searchParams.get("public")!=="true" && !request.nextUrl.searchParams.has("token")) return read(request);
 try {
  const { db, property, questionnaire } = await resolvePublicFeedbackLink(request.nextUrl.searchParams.get("token"));
  const questions=await publicQuestions(db,property,questionnaire);
  return NextResponse.json({success:true,questions},{headers:{"Cache-Control":"no-store"}});
 }catch(error){return errorResponse(error);}
}

export const POST=withWorkspace(async(request:NextRequest)=>{
 const b=await readJson(request),user=workspaceUser(),db=workspaceDb();
 let propertyId=b.propertyId==null?null:text(b.propertyId,"Property",50);
 if(b.questionnaireId){const form=checked(await db.from("feedback_questionnaires").select("id,property_id").eq("id",text(b.questionnaireId,"Questionnaire",50)).single());if(b.propertyId&&b.propertyId!==form.property_id)throw new PlatformError("Questionnaire belongs to another property.",403);propertyId=form.property_id;}
 if(propertyId)await assertProperty(propertyId);
 else if(!user.isOrganizationAdmin)throw new PlatformError("Choose a property questionnaire.",403);
 const question=checked(await db.from("feedback_questions").insert({organization_id:user.organizationId,property_id:propertyId,questionnaire_id:b.questionnaireId||null,...questionFields(b,false)}).select().single());
 return NextResponse.json({success:true,question,synced:true},{status:201});
},"manage_questionnaire");
export const PATCH=withWorkspace(async(request:NextRequest)=>{
 const b=await readJson(request),p=questionFields(b,true),id=text(b.id,"Question",50);
 if(!Object.keys(p).length)throw new PlatformError("No question changes supplied.");
 const question=checked(await workspaceDb().from("feedback_questions").update(p).eq("id",id).select().single());
 return NextResponse.json({success:true,question,synced:true});
},"manage_questionnaire");
export const DELETE=withWorkspace(async(request:NextRequest)=>{
 const b=await readJson(request);checked(await workspaceDb().from("feedback_questions").delete().eq("id",b.id).select("id").single());return NextResponse.json({success:true});
},"manage_questionnaire");
