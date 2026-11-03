import { NextRequest, NextResponse } from "next/server";
import { readJson, withWorkspace, text } from "../../../lib/platform/http";
import { assertProperty, checked, workspaceDb, workspaceUser, PlatformError } from "../../../lib/platform/db";
import { hasModuleAccess } from "../../../lib/auth/modules";
function context() {
 const user=workspaceUser();
 if (!hasModuleAccess(user,"feedback")) throw new PlatformError("Feedback module access required.",403);
 return { user, db:workspaceDb() };
}
export const GET=withWorkspace(async(request:NextRequest)=>{
 const {db}=context();
 const propertyId=text(request.nextUrl.searchParams.get("propertyId"),"Property",50);
 await assertProperty(propertyId);
 return NextResponse.json({success:true,questionnaires:checked(await db.from("feedback_questionnaires").select("*").eq("property_id",propertyId).order("created_at"))});
},"manage_questionnaire");
export const POST=withWorkspace(async(request:NextRequest)=>{
 const {user,db}=context(),body=await readJson(request);
 const propertyId=text(body.propertyId,"Property",50); await assertProperty(propertyId);
 const questionnaire=checked(await db.from("feedback_questionnaires").insert({organization_id:user.organizationId,property_id:propertyId,name:text(body.name,"Questionnaire name",100)}).select().single());
 return NextResponse.json({success:true,questionnaire},{status:201});
},"manage_questionnaire");
export const PATCH=withWorkspace(async(request:NextRequest)=>{
 const {db}=context(),body=await readJson(request),id=text(body.id,"Questionnaire",50);
 checked(await db.from("feedback_questionnaires").select("id").eq("id",id).single());
 const patch:Record<string,unknown>={};
 if(body.name!==undefined)patch.name=text(body.name,"Questionnaire name",100);
 if(body.title!==undefined)patch.title=text(body.title,"Form title",160);
 if(body.introduction!==undefined)patch.introduction=text(body.introduction,"Introduction",500,false);
 if(body.accentColor!==undefined){if(typeof body.accentColor!=="string"||!/^#[a-f0-9]{6}$/i.test(body.accentColor))throw new PlatformError("Choose a valid accent color.");patch.accent_color=body.accentColor;}
 if(Object.keys(patch).length)checked(await db.from("feedback_questionnaires").update(patch).eq("id",id).select().single());
 const questionnaire=body.isDefault===true?checked(await db.rpc("select_guest_questionnaire",{p_id:id})):checked(await db.from("feedback_questionnaires").select("*").eq("id",id).single());
 return NextResponse.json({success:true,questionnaire});
},"manage_questionnaire");
