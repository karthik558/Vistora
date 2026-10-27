import {NextRequest,NextResponse} from "next/server";
import {withWorkspace,text} from "../../../../lib/platform/http";
import {checked,workspaceDb,workspaceUser,serviceDb,PlatformError} from "../../../../lib/platform/db";
import {randomUUID} from "node:crypto";
type Context={params:Promise<{id:string}>};
async function caseRow(id:string){return checked(await workspaceDb().from("feedback").select("*").eq("id",id).single());}
export const GET=withWorkspace(async(request:NextRequest,{params}:Context)=>{
 const {id}=await params;const record=await caseRow(id),db=workspaceDb();
 const comments=checked(await db.from("feedback_comments").select("id,body,created_at,author_id,profiles!author_id(full_name)").eq("feedback_id",id).order("created_at"));
 const activity=checked(await db.from("feedback_activity").select("*").eq("feedback_id",id).order("created_at"));
 const actors=Array.from(new Set(activity.map(a=>a.actor_id).filter(Boolean)));
 const names=actors.length?checked(await db.from("profiles").select("id,full_name").in("id",actors)):[];
 for(const a of activity)a.actor_name=names.find(n=>n.id===a.actor_id)?.full_name||(a.actor_id?"Former team member":"System");
 const attachments=checked(await db.from("feedback_attachments").select("id,filename,size_bytes,content_type,created_at").eq("feedback_id",id).order("created_at"));
 const download=request.nextUrl.searchParams.get("download");
 if(download) {
  const attachment=checked(await db.from("feedback_attachments").select("object_path,filename").eq("id",download).eq("feedback_id",id).single());
  const signed=checked(await serviceDb().storage.from("case-attachments").createSignedUrl(attachment.object_path,60,{download:attachment.filename}));
  return NextResponse.json({success:true,url:signed.signedUrl});
 }
 const members=checked(await db.from("organization_members").select("user_id").eq("is_active",true));
 const team=members.length?checked(await db.from("profiles").select("id,full_name,property_id,property_ids,role").in("id",members.map(m=>m.user_id))):[];
 return NextResponse.json({success:true,record,canReassign:workspaceUser().isOrganizationAdmin||!record.routing_rule_id,team:team.filter(p=>p.role==="admin"||p.property_id===record.property_id||p.property_ids?.includes(record.property_id)).map(p=>p.full_name),comments,activity,attachments},{headers:{"Cache-Control":"no-store"}});
},"manage_complaints");
export const POST=withWorkspace(async(request:NextRequest,{params}:Context)=>{
 const {id}=await params,row=await caseRow(id),user=workspaceUser(),db=workspaceDb();
 if(request.headers.get("content-type")?.includes("multipart/form-data")) {
  if(Number(request.headers.get("content-length"))>6*1024*1024)throw new PlatformError("File must be at most 5 MB.");
  const form=await request.formData(),file=form.get("file");
  if(!(file instanceof File)||!file.size||file.size>5*1024*1024)throw new PlatformError("Choose a file of 1 byte to 5 MB.");
  const bytes=Buffer.from(await file.arrayBuffer());
  const jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255,png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),pdf=bytes.subarray(0,5).toString()==="%PDF-";
  const type=jpg?"image/jpeg":png?"image/png":pdf?"application/pdf":file.type==="text/plain"&&!bytes.includes(0)?"text/plain":null;
  if(!type)throw new PlatformError("Only JPG, PNG, PDF and plain text files are supported.");
  const path=row.organization_id+"/"+id+"/"+randomUUID(),name=file.name.replace(/[^\w. -]/g,"_").slice(0,150);
  const storage=serviceDb().storage.from("case-attachments");
  checked(await storage.upload(path,bytes,{contentType:type,upsert:false}));
  try {checked(await db.from("feedback_attachments").insert({organization_id:row.organization_id,feedback_id:id,uploaded_by:user.id,object_path:path,filename:name,content_type:type,size_bytes:file.size}).select().single());}
  catch(error){await storage.remove([path]);throw error;}
 } else {
  const b=await request.json();
  checked(await db.from("feedback_comments").insert({organization_id:row.organization_id,feedback_id:id,author_id:user.id,body:text(b.body,"Internal note",4000)}).select().single());
 }
 return NextResponse.json({success:true},{status:201});
},"manage_complaints");
