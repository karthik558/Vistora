import {NextRequest,NextResponse} from "next/server";
import {withWorkspace,text,email,number} from "../../../lib/platform/http";
import {checked,workspaceDb,workspaceUser,PlatformError} from "../../../lib/platform/db";
import {getApplicationSettings} from "../../../lib/services/settingsService";
import {hospitalityConfig,moneyToMinor} from "../../../lib/hospitality/config";
import {newToken} from "../../../lib/platform/secrets";
import {logAuditEvent} from "../../../lib/services/auditLogService";
import {hasModuleAccess} from "../../../lib/auth/modules";
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
  list(db.from("stays").select("id,property_id,guest_id,room_id,room_number,guest_count,check_in_date,check_out_date,status,guests(full_name),feedback(id,rating,status)").not("room_id","is",null).order("created_at",{ascending:false}).limit(100),propertyId),
  list(db.from("service_jobs").select("*,assignee:profiles!assigned_to(full_name)").in("status",jobView==="active"?["open","in_progress"]:["completed","cancelled"]).order("due_at",{ascending:jobView==="active"}).limit(100),propertyId),
  list(db.from("room_inspections").select("*").order("created_at",{ascending:false}).limit(100),propertyId),
  list(db.from("operating_costs").select("*").gte("expense_date",month+"-01").lt("expense_date",new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),1)).toISOString().slice(0,10)).order("created_at",{ascending:false}).limit(100),propertyId),
  db.from("hotel_activity").select("*").order("created_at",{ascending:false}).limit(50),
  db.rpc("hotel_budget_snapshot",{p_month:month+"-01"}),
  db.from("organization_members").select("user_id,role").eq("is_active",true),
  list(db.from("feedback").select("id,property_id,room_number,department,rating").neq("status","resolved").order("created_at",{ascending:false}).limit(100),propertyId)
 ]);
 const memberRows=checked(members);
 const team=memberRows.length?checked(await db.from("profiles").select("id,full_name,property_id,property_ids").in("id",memberRows.map(m=>m.user_id))):[];
 return NextResponse.json({success:true,metrics,config,properties:checked(properties),guests:checked(guests),rooms:checked(rooms),stays:checked(stays),jobs:checked(jobs),inspections:checked(inspections),costs:checked(costs),activity:checked(activity),budget:checked(budget),feedback:checked(feedback),team:team.map(p=>({...p,isAdmin:memberRows.some(m=>m.user_id===p.id&&["owner","admin"].includes(m.role))}))},{headers:{"Cache-Control":"no-store"}});
});
export const POST=withWorkspace(async(request:NextRequest)=>{
 admin();const b=await request.json(),db=workspaceDb(),user=workspaceUser(),config=hospitalityConfig((await getApplicationSettings()).hospitality);
 const modules:Record<string,keyof typeof config.modules>={guest:"guests",room:"property",stay:"guests",job:"operations",inspection:"compliance",cost:"operations"};
 const module=modules[b.action];if(!module)throw new PlatformError("Unknown operation.");
 if(!config.modules[module])throw new PlatformError("This module is disabled in Settings.",403);
 let result:any;
 if(b.action==="guest"){
  result=checked(await db.from("guests").insert({organization_id:user.organizationId,full_name:text(b.full_name,"Guest name",100),email:b.email?email(b.email):null,phone:text(b.phone,"Phone",40,false)||null,vip_tier:text(b.vip_tier||"Standard","Guest tier",30),preferences:text(b.preferences,"Preferences",2000,false)}).select("id").single());
 }else if(b.action==="room"){
  await property(b.property_id);
  if(!["dirty","clean","out_of_service"].includes(b.status||"dirty"))throw new PlatformError("Use an inspection to mark a room inspected.");
  result=checked(await db.from("hotel_rooms").insert({organization_id:user.organizationId,property_id:b.property_id,room_number:text(b.room_number,"Room number",30),floor:text(b.floor,"Floor",30,false),room_type:text(b.room_type||"Standard","Room type",60),capacity:number(Number(b.capacity),"Capacity",1,20),status:b.status||"dirty",notes:text(b.notes,"Notes",2000,false)}).select("id").single());
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
 admin();const b=await request.json(),db=workspaceDb(),config=hospitalityConfig((await getApplicationSettings()).hospitality);
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
  if(!Object.keys(updates).length)throw new PlatformError("No changes supplied.");
 }else if(b.action==="cost"){
  table="operating_costs";if(!["approved","rejected"].includes(b.status))throw new PlatformError("Choose approve or reject.");updates={status:b.status};
 }
 const result=checked(await db.from(table).update(updates).eq("id",text(b.id,"Record",50)).select("id").single());
 return NextResponse.json({success:true,result});
});
