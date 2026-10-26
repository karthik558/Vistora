import {NextRequest,NextResponse} from "next/server";
import {withWorkspace,text,errorResponse} from "../../../lib/platform/http";
import {checked,workspaceDb,serviceDb,workspaceUser,PlatformError,assertProperty} from "../../../lib/platform/db";
export interface FeedbackQuestion {id:string;property_id?:string|null;question_text:string;question_type:string;options?:string[];department?:string|null;translations?:Record<string,{questionText?:string;options?:string[]}>;is_required:boolean;display_order:number;is_active:boolean;created_at?:string;}
export async function GET(request:NextRequest) {
 const read=withWorkspace(async(req:NextRequest)=>{
  let q=workspaceDb().from("feedback_questions").select("*").order("display_order");
  if(req.nextUrl.searchParams.get("all")!=="true")q=q.eq("is_active",true);
  const id=req.nextUrl.searchParams.get("propertyId");if(id)q=q.or("property_id.is.null,property_id.eq."+id);
  return NextResponse.json({success:true,questions:checked(await q),synced:true});
 },"manage_questionnaire");
 if(request.nextUrl.searchParams.get("public")!=="true"&&(request.cookies.get("sb-access-token")||request.headers.get("authorization")))return read(request);
 try {
  const id=request.nextUrl.searchParams.get("propertyId");if(!id)return NextResponse.json({success:true,questions:[]});
  const db=serviceDb(),property=checked(await db.from("properties").select("organization_id").eq("id",id).eq("is_active",true).single());
  const questions=checked(await db.from("feedback_questions").select("id,question_text,question_type,options,translations,is_required,display_order,department").eq("organization_id",property.organization_id).eq("is_active",true).or("property_id.is.null,property_id.eq."+id).order("display_order"));
  return NextResponse.json({success:true,questions});
 }catch(error){return errorResponse(error);}
}
export const POST=withWorkspace(async(request:NextRequest)=>{
 const b=await request.json();if(b.propertyId)await assertProperty(b.propertyId);
 if(!["choice","multi_choice","rating","yes_no","text","long_text","nps","csat","emoji","touchpoint","dropdown"].includes(b.questionType||"choice"))throw new PlatformError("Invalid question type.");
 const question=checked(await workspaceDb().from("feedback_questions").insert({organization_id:workspaceUser().organizationId,property_id:b.propertyId||null,question_text:text(b.questionText,"Question",300),question_type:b.questionType||"choice",options:Array.isArray(b.options)?b.options.slice(0,30).map((o:any)=>text(o,"Option",100)):[],is_required:b.isRequired===true,department:b.department||null,translations:b.translations||{},display_order:Math.min(1000,Math.max(0,Number(b.displayOrder)||0)),is_active:true}).select().single());
 return NextResponse.json({success:true,question,synced:true},{status:201});
},"manage_questionnaire");
export const PATCH=withWorkspace(async(request:NextRequest)=>{
 const b=await request.json(),p:Record<string,unknown>={};
 if(b.isActive!==undefined)p.is_active=b.isActive===true;
 if(b.isRequired!==undefined)p.is_required=b.isRequired===true;
 if(b.questionText!==undefined)p.question_text=text(b.questionText,"Question",300);
 if(b.translations!==undefined)p.translations=b.translations;
 const question=checked(await workspaceDb().from("feedback_questions").update(p).eq("id",b.id).select().single());
 return NextResponse.json({success:true,question,synced:true});
},"manage_questionnaire");
export const DELETE=withWorkspace(async(request:NextRequest)=>{
 const b=await request.json();checked(await workspaceDb().from("feedback_questions").delete().eq("id",b.id).select("id").single());return NextResponse.json({success:true});
},"manage_questionnaire");
