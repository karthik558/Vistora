import {NextRequest,NextResponse} from "next/server";
import {withWorkspace,text,email,number} from "../../../lib/platform/http";
import {checked,workspaceDb,workspaceUser,PlatformError} from "../../../lib/platform/db";
import {getApplicationSettings} from "../../../lib/services/settingsService";
import {hospitalityConfig,moneyToMinor} from "../../../lib/hospitality/config";
import {newToken} from "../../../lib/platform/secrets";
import {logAuditEvent} from "../../../lib/services/auditLogService";
import {hasModuleAccess} from "../../../lib/auth/modules";
import {canManageServiceJobs} from "../../../lib/operations/access";
import {COMPLAINT_ISSUES,OPERATIONS_DEPARTMENTS} from "../../../lib/operations/complaints";
import {hotelReadView} from "../../../lib/hospitality/read-view";

function admin(){if(!workspaceUser().isOrganizationAdmin)throw new PlatformError("Company administrator access required.",403);}
function date(value:unknown,label:string){
 const clean=text(value,label,10);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(clean)||!Number.isFinite(Date.parse(clean))||new Date(clean).toISOString().slice(0,10)!==clean)throw new PlatformError("Enter a valid "+label.toLowerCase()+".");
 return clean;
}
async function property(id:string){
 const row=checked(await workspaceDb().from("properties").select("id,is_active").eq("id",id).single());
 if(!row.is_active)throw new PlatformError("Choose an active property.");return row;
}
async function room(id:string){return checked(await workspaceDb().from("hotel_rooms").select("*").eq("id",id).single());}
function list(q:any,id:string|null){return id&&id!=="all"?q.eq("property_id",id):q;}
export const GET=withWorkspace(async(request:NextRequest)=>{
 if(!hasModuleAccess(workspaceUser(),"hospitality"))throw new PlatformError("Hotel operations module access required.",403);
 if(!workspaceUser().isOrganizationAdmin)return hotelReadView(request);
 const db=workspaceDb(),settings=await getApplicationSettings(),config=hospitalityConfig(settings.hospitality);
 const linkId=request.nextUrl.searchParams.get("stayLink");
 if(linkId){
  const stay=checked(await db.from("stays").select("id,public_token,status").eq("id",linkId).single());
  if(stay.status!=="active")throw new PlatformError("Feedback links are available after check-in.");
  const user=workspaceUser();
  await logAuditEvent({actorName:user.fullName,actorEmail:user.email,actorRole:user.role,action:"Stay feedback link accessed",category:"pii_access",resource:stay.id});
  return NextResponse.json({success:true,path:"/feedback/"+stay.public_token},{headers:{"Cache-Control":"private, no-store"}});
 }
 const readiness=await db.rpc("complaint_schema_ready");
 if(request.nextUrl.searchParams.get("complaints")==="true"&&(readiness.error||readiness.data!==true))throw new PlatformError("Complaint setup is pending. Apply schema section 27 after section 26.",503);
 const propertyId=request.nextUrl.searchParams.get("property")||"all";
 if(propertyId!=="all")checked(await db.from("properties").select("id").eq("id",propertyId).single());
 const month=request.nextUrl.searchParams.get("month")||new Date().toISOString().slice(0,7);
 const jobView=request.nextUrl.searchParams.get("jobs")||"active";
 if(!["active","closed"].includes(jobView))throw new PlatformError("Choose a valid job view.");
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw new PlatformError("Choose a valid month.");
 const counts=await Promise.all([
  db.from("guests").select("id",{count:"exact",head:true}),
  list(db.from("hotel_rooms").select("id",{count:"exact",head:true}),propertyId),
  list(db.from("stays").select("id",{count:"exact",head:true}).eq("status","active").not("room_id","is",null),propertyId),
  list(db.from("hotel_rooms").select("id",{count:"exact",head:true}).in("status",["dirty","out_of_service"]),propertyId),
  list(db.from("service_jobs").select("id",{count:"exact",head:true}).in("status",["open","in_progress"]),propertyId),
  list(db.from("operating_costs").select("id",{count:"exact",head:true}).eq("status","pending"),propertyId)
 ]);
 counts.forEach(result=>{if(result.error&&["42P01","PGRST205"].includes(result.error.code)||!result.error&&result.count===null)throw new PlatformError("Hotel operations setup is pending. Apply section 20 onward in supabase/schema.sql.",503);checked({data:true,error:result.error});});
 const metrics=Object.fromEntries(["guests","rooms","inHouse","roomsNeedService","openJobs","pendingCosts"].map((key,i)=>[key,counts[i].count]));
 if(request.nextUrl.searchParams.get("summary")==="true")return NextResponse.json({success:true,metrics,config});
 let guestsQuery=db.from("guests").select("id,full_name,email,phone,vip_tier,preferences,created_at").order("created_at",{ascending:false}).limit(100);
 const search=request.nextUrl.searchParams.get("search")?.trim().slice(0,100);if(search)guestsQuery=guestsQuery.ilike("full_name","%"+search.replace(/[%_\\]/g,"\\$&")+"%");
 const [properties,guests,rooms,stays,jobs,inspections,costs,activity,budget,members,feedback]=await Promise.all([
  db.from("properties").select("id,name,is_active").order("name"),
  guestsQuery,
  list(db.from("hotel_rooms").select("*").order("room_number").limit(200),propertyId),
  list(db.from("stays").select("id,property_id,guest_id,room_id,room_number,guest_count,check_in_date,check_out_date,status,public_token,guests(id,full_name,email,phone,vip_tier,preferences),feedback(id,rating,status)").not("room_id","is",null).order("created_at",{ascending:false}).limit(100),propertyId),
  list((request.nextUrl.searchParams.get("complaints")==="true"?db.from("service_jobs").select("*,assignee:profiles!assigned_to(full_name)").not("issue_type","is",null):db.from("service_jobs").select("*,assignee:profiles!assigned_to(full_name)")).in("status",jobView==="active"?["open","in_progress"]:["completed","cancelled"]).order("due_at",{ascending:jobView==="active"}).limit(100),propertyId),
  list(db.from("room_inspections").select("*").order("created_at",{ascending:false}).limit(100),propertyId),
  list(db.from("operating_costs").select("*").gte("expense_date",month+"-01").lt("expense_date",new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),1)).toISOString().slice(0,10)).order("created_at",{ascending:false}).limit(100),propertyId),
  db.from("hotel_activity").select("*").order("created_at",{ascending:false}).limit(50),
  db.rpc("hotel_budget_snapshot",{p_month:month+"-01"}),
  db.from("organization_members").select("user_id,role").eq("is_active",true),
  list(db.from("feedback").select("id,property_id,room_number,department,rating").neq("status","resolved").order("created_at",{ascending:false}).limit(100),propertyId)
 ]);
 const memberRows=checked(members);
 const team=memberRows.length?checked(await db.from("profiles").select("id,full_name,property_id,property_ids").in("id",memberRows.map(m=>m.user_id))):[];
 return NextResponse.json({success:true,metrics,config,complaintsReady:readiness.data===true,properties:checked(properties),guests:checked(guests),rooms:checked(rooms),stays:checked(stays),jobs:checked(jobs),inspections:checked(inspections),costs:checked(costs),activity:checked(activity),budget:checked(budget),feedback:checked(feedback),team:team.map(p=>({...p,isAdmin:memberRows.some(m=>m.user_id===p.id&&["owner","admin"].includes(m.role))}))},{headers:{"Cache-Control":"no-store"}});
});
export const POST=withWorkspace(async(request:NextRequest)=>{
 const b=await request.json(),db=workspaceDb(),user=workspaceUser();
 if(b.action==="complaint"){
  if(!canManageServiceJobs(user))throw new PlatformError("Complaint intake requires hotel operations permission.",403);
  const ready=await db.rpc("complaint_schema_ready");if(ready.error||ready.data!==true)throw new PlatformError("Complaint setup is pending. Apply schema section 27 after section 26.",503);
  const issue=COMPLAINT_ISSUES.find(i=>i.id===b.issue_type);if(!issue)throw new PlatformError("Choose a valid issue.");
  const department=issue.id==="other"?text(b.department,"Department",80):issue.department;
  if(!OPERATIONS_DEPARTMENTS.includes(department as any))throw new PlatformError("Choose a valid department.");
  if(!["low","normal","high","critical"].includes(b.priority||"normal")||!["staff","front_desk","phone","guest_request"].includes(b.intake_channel||"staff"))throw new PlatformError("Invalid priority or intake channel.");
  const id=checked(await db.rpc("submit_service_complaint",{p_complaint:{property_id:text(b.property_id,"Property",50),issue_type:issue.id,department,title:text(b.title||issue.label,"Complaint title",160),location:text(b.location,"Room / location",100),description:text(b.description,"Details",2000,false),priority:b.priority||"normal",intake_channel:b.intake_channel||"staff"}}));
  return NextResponse.json({success:true,result:{id}},{status:201});
 }
 if(b.action==="job"){
  if(!user.isOrganizationAdmin&&!canManageServiceJobs(user))throw new PlatformError("Company administrator or service job management access required.",403);
 }else if(b.action==="room"){
  if(!user.isOrganizationAdmin&&!user.rights?.includes("manage_properties"))throw new PlatformError("Company administrator or property management access required.",403);
 }else{
  admin();
 }
 const config=hospitalityConfig((await getApplicationSettings()).hospitality);
 const modules:Record<string,keyof typeof config.modules>={guest:"guests",room:"property",stay:"guests",job:"operations",inspection:"compliance",cost:"operations"};
 const module=modules[b.action];if(!module)throw new PlatformError("Unknown operation.");
 if(!config.modules[module])throw new PlatformError("This module is disabled in Settings.",403);
 let result:any;
 if(b.action==="guest"){
  result=checked(await db.from("guests").insert({organization_id:user.organizationId,full_name:text(b.full_name,"Guest name",100),email:b.email?email(b.email):null,phone:text(b.phone,"Phone",40,false)||null,vip_tier:text(b.vip_tier||"Standard","Guest tier",30),preferences:text(b.preferences,"Preferences",2000,false)}).select("id").single());
 }else if(b.action==="room"){
  await property(b.property_id);
  if(Array.isArray(b.rooms)){
   const rows=b.rooms.map((r:any)=>{
    let notes=text(r.notes||"","Notes",2000,false);
    if(r.view&&typeof r.view==="string"&&r.view.trim())notes=notes?`View: ${r.view.trim()} · ${notes}`:`View: ${r.view.trim()}`;
    return {
     organization_id:user.organizationId,
     property_id:b.property_id,
     room_number:text(r.room_number,"Room number",30),
     floor:text(r.floor||"","Floor",30,false),
     room_type:text(r.room_type||"Standard","Room type",60),
     capacity:number(Number(r.capacity||2),"Capacity",1,20),
     status:["dirty","clean","out_of_service"].includes(r.status)?r.status:"clean",
     notes,
     updated_at:new Date().toISOString()
    };
   });
   result=checked(await db.from("hotel_rooms").upsert(rows,{onConflict:"property_id,room_number"}).select("id"));
  }else{
   if(!["dirty","clean","out_of_service"].includes(b.status||"dirty"))throw new PlatformError("Use an inspection to mark a room inspected.");
   let notes=text(b.notes||"","Notes",2000,false);
   if(b.view&&typeof b.view==="string"&&b.view.trim())notes=notes?`View: ${b.view.trim()} · ${notes}`:`View: ${b.view.trim()}`;
   result=checked(await db.from("hotel_rooms").upsert({organization_id:user.organizationId,property_id:b.property_id,room_number:text(b.room_number,"Room number",30),floor:text(b.floor,"Floor",30,false),room_type:text(b.room_type||"Standard","Room type",60),capacity:number(Number(b.capacity),"Capacity",1,20),status:b.status||"dirty",notes,updated_at:new Date().toISOString()},{onConflict:"property_id,room_number"}).select("id").single());
  }
  const countRes=await db.from("hotel_rooms").select("id",{count:"exact",head:true}).eq("property_id",b.property_id);
  if(countRes.count!==null&&countRes.count>0)await db.from("properties").update({total_rooms:countRes.count}).eq("id",b.property_id);
 }else if(b.action==="stay"){
  const selected=await room(b.room_id);await property(selected.property_id);
  checked(await db.from("guests").select("id").eq("id",b.guest_id).single());
  const arrival=date(b.check_in_date,"Arrival date"),departure=date(b.check_out_date,"Departure date");
  if(departure<=arrival)throw new PlatformError("Departure must follow arrival.");
  result=checked(await db.from("stays").insert({organization_id:user.organizationId,property_id:selected.property_id,room_id:selected.id,guest_id:b.guest_id,room_number:selected.room_number,guest_count:number(Number(b.guest_count),"Guest count",1,20),check_in_date:arrival,check_out_date:departure,public_token:newToken(),status:"reserved"}).select("id").single());
 }else if(b.action==="job"){
  await property(b.property_id);
  if(!["guest_request","cleaning","maintenance","inspection"].includes(b.kind))throw new PlatformError("Choose a valid job type.");
  if(!["low","normal","high","critical"].includes(b.priority))throw new PlatformError("Choose a valid priority.");
  if(b.due_at&&!Number.isFinite(Date.parse(b.due_at)))throw new PlatformError("Enter a valid deadline.");
  result=checked(await db.from("service_jobs").insert({organization_id:user.organizationId,property_id:b.property_id,room_id:b.room_id||null,feedback_id:b.feedback_id||null,kind:b.kind,title:text(b.title,"Job title",160),description:text(b.description,"Description",2000,false),priority:b.priority,assigned_to:b.assigned_to||null,created_by:user.id,due_at:b.due_at?new Date(b.due_at).toISOString():new Date(Date.now()+config.taskResponseMinutes*60000).toISOString()}).select("id").single());
 }else if(b.action==="inspection"){
  const selected=await room(b.room_id);
  if(!Array.isArray(b.answers)||b.answers.length>30)throw new PlatformError("Complete the inspection checklist.");
  result=checked(await db.from("room_inspections").insert({organization_id:user.organizationId,property_id:selected.property_id,room_id:selected.id,inspector_id:user.id,answers:b.answers,notes:text(b.notes,"Inspection notes",2000,false)}).select("id,passed").single());
 }else if(b.action==="cost"){
  await property(b.property_id);
  let amount:number;try{amount=moneyToMinor(b.amount);}catch(error){throw new PlatformError((error as Error).message);}
  if(amount<=0)throw new PlatformError("Enter a positive amount.");
  if(!["supplies","maintenance","guest_recovery","other"].includes(b.category))throw new PlatformError("Choose a valid cost category.");
  result=checked(await db.from("operating_costs").insert({organization_id:user.organizationId,property_id:b.property_id,job_id:b.job_id||null,description:text(b.description,"Cost description",300),category:b.category,amount_minor:amount,currency:config.currency,requested_by:user.id}).select("id,status").single());
 }
 return NextResponse.json({success:true,result},{status:201});
});
export const PATCH=withWorkspace(async(request:NextRequest)=>{
 const b=await request.json(),db=workspaceDb(),user=workspaceUser();
 if(!workspaceUser().isOrganizationAdmin){
  if(b.action==="stay"&&b.status==="checked_out"&&hasModuleAccess(workspaceUser(),"hospitality")){
   const current=checked(await db.from("stays").select("id,room_id,status").eq("id",text(b.id,"Stay",50)).single());
   if(current.status!=="active")throw new PlatformError("Only active stays can be checked out.");
   const result=checked(await db.from("stays").update({status:"checked_out"}).eq("id",current.id).select("id").single());
   return NextResponse.json({success:true,result});
  }
  if(!canManageServiceJobs(workspaceUser())||b.action!=="job"||Object.keys(b).some(k=>!["action","id","status","acknowledge"].includes(k)))throw new PlatformError("You may only attend your assigned service jobs.",403);
  const current=checked(await db.from("service_jobs").select("id,assigned_to,status,acknowledged_at").eq("id",text(b.id,"Job",50)).single());
  if(current.assigned_to!==workspaceUser().id||!["open","in_progress"].includes(current.status))throw new PlatformError("This job is not assigned to you or is already closed.",403);
  if(b.status!==undefined&&!["in_progress","completed"].includes(b.status))throw new PlatformError("Choose start or complete.");
  if(b.status===undefined&&b.acknowledge!==true)throw new PlatformError("No attendance action supplied.");
  const updates:Record<string,unknown>={};if(b.status)updates.status=b.status;if(b.acknowledge===true)updates.acknowledged_at=current.acknowledged_at||new Date().toISOString();
  const result=checked(await db.from("service_jobs").update(updates).eq("id",current.id).select("id").single());return NextResponse.json({success:true,result});
 }
 if(b.action==="job"){
  if(!user.isOrganizationAdmin&&!canManageServiceJobs(user))throw new PlatformError("Company administrator or service job management access required.",403);
 }else if(b.action==="room"){
  if(!user.isOrganizationAdmin&&!user.rights?.includes("manage_properties"))throw new PlatformError("Company administrator or property management access required.",403);
 }else{
  admin();
 }
 const config=hospitalityConfig((await getApplicationSettings()).hospitality);
 const modules:Record<string,keyof typeof config.modules>={guest:"guests",room:"property",stay:"guests",job:"operations",cost:"operations"};
 const module=modules[b.action];if(!module||!config.modules[module])throw new PlatformError("This module is disabled or unknown.",403);
 let table="",updates:Record<string,unknown>={};
 if(b.action==="guest"){
  table="guests";updates={full_name:text(b.full_name,"Guest name",100),email:b.email?email(b.email):null,phone:text(b.phone,"Phone",40,false)||null,vip_tier:text(b.vip_tier||"Standard","Guest tier",30),preferences:text(b.preferences,"Preferences",2000,false)};
 }else if(b.action==="room"){
  table="hotel_rooms";if(!["dirty","clean","out_of_service"].includes(b.status))throw new PlatformError("Choose a valid room state. Readiness requires a recorded inspection.");
  updates={status:b.status,notes:text(b.notes,"Notes",2000,false)};
 }else if(b.action==="stay"){
  table="stays";if(!["active","checked_out","cancelled"].includes(b.status))throw new PlatformError("Choose a valid stay transition.");updates={status:b.status};
 }else if(b.action==="job"){
  table="service_jobs";
  if(b.status!==undefined){if(!["open","in_progress","completed","cancelled"].includes(b.status))throw new PlatformError("Invalid job status.");updates.status=b.status;}
  if(b.assigned_to!==undefined)updates.assigned_to=b.assigned_to||null;
  if(b.acknowledge===true)updates.acknowledged_at=new Date().toISOString();
  if(!Object.keys(updates).length)throw new PlatformError("No changes supplied.");
 }else if(b.action==="cost"){
  table="operating_costs";if(!["approved","rejected"].includes(b.status))throw new PlatformError("Choose approve or reject.");updates={status:b.status};
 }
 const result=checked(await db.from(table).update(updates).eq("id",text(b.id,"Record",50)).select("id").single());
 return NextResponse.json({success:true,result});
});
