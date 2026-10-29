import {integrationStatus} from "../../../lib/platform/integrationStatus";
import {NextRequest,NextResponse} from "next/server";
import {withWorkspace,text,email,number} from "../../../lib/platform/http";
import {checked,workspaceDb,workspaceUser,serviceDb,assertProperty,PlatformError} from "../../../lib/platform/db";
import {newToken,hashToken,encryptSecret} from "../../../lib/platform/secrets";
import {managementReport,reportRows} from "../../../lib/platform/reports";
import {logAuditEvent} from "../../../lib/services/auditLogService";
function admin(){if(!workspaceUser().isOrganizationAdmin)throw new PlatformError("Workspace administrator required.",403);}
export const GET=withWorkspace(async(request:NextRequest)=>{
 admin();
 const db=workspaceDb(),user=workspaceUser();
 const properties=checked(await db.from("properties").select("id,name").order("name"));
 const views=checked(await db.from("saved_views").select("*").order("created_at",{ascending:false}));
 const organization=checked(await db.from("organizations").select("*").single());
 const result:any={success:true,properties,views,organization,isAdmin:user.isOrganizationAdmin};
 if(user.isOrganizationAdmin)result.recovery=checked(await db.from("recovery_followups").select("id,feedback_id,rating,recommendation_score,responded_at,created_at").order("created_at",{ascending:false}).limit(100));
 if(user.isOrganizationAdmin||user.rights.includes("manage_complaints")) {
  result.cases=checked(await db.from("feedback").select("id,property_id,department,rating,status,assigned_to,priority,sla_deadline,category,created_at").neq("status","resolved").order("sla_deadline",{ascending:true,nullsFirst:false}).limit(200));
 }
 if(user.isOrganizationAdmin||user.rights.includes("export_reports")) {
  const days=Math.min(366,Math.max(1,Number(request.nextUrl.searchParams.get("days"))||30)),property=request.nextUrl.searchParams.get("property");
  if(property&&property!=="all")await assertProperty(property);
  result.report=managementReport(await reportRows(db,user.organizationId,days,property),days);
 }
 if(user.isOrganizationAdmin) {
  result.integrationStatus=integrationStatus(process.env);
  const tables=["sla_policies","report_schedules","report_runs","team_invitations","notification_outbox","notification_deliveries"];
  for(const table of tables)result[table]=checked(await db.from(table).select(table==="team_invitations"?"id,email,property_ids,rights,expires_at,accepted_at,created_at":table==="notification_outbox"?"id,kind,status,attempts,last_error,available_at,created_at":"*").order("created_at",{ascending:false}).limit(100));
  result.api_keys=checked(await db.from("api_keys").select("id,name,prefix,scopes,expires_at,revoked_at,last_used_at").order("created_at",{ascending:false}));
  result.webhook_endpoints=checked(await db.from("webhook_endpoints").select("id,url,is_active,created_at").order("created_at",{ascending:false}));
  const members=checked(await db.from("organization_members").select("user_id").eq("is_active",true));
  result.checklist={property:properties.length>0,team:members.length>1,branding:!!organization.logo_url,sla:result.sla_policies.length>0,reports:result.report_schedules.length>0};
 }
 return NextResponse.json(result,{headers:{"Cache-Control":"no-store"}});
});
export const POST=withWorkspace(async(request:NextRequest)=>{
 admin();
 const b=await request.json(),db=workspaceDb(),user=workspaceUser(),org=user.organizationId;
 let result:any={};
 if(b.action==="save_view") {
  const f=b.filters||{};
  if(f.property&&f.property!=="all")await assertProperty(f.property);
  result=checked(await db.from("saved_views").insert({organization_id:org,user_id:user.id,name:text(b.name,"View name",80),filters:{property:f.property||"all",days:number(Number(f.days)||30,"Days",1,366),queue:["all","overdue","unassigned"].includes(f.queue)?f.queue:"all"}}).select().single());
 } else {
  admin();
  if(b.action==="branding") {
   const logo=text(b.logo_url,"Logo URL",1000,false);
   if(logo&&!/^https:\/\/[^\s]+$/.test(logo))throw new PlatformError("Logo must be an HTTPS image URL.");
   if(!/^#[0-9a-f]{6}$/i.test(b.brand_color||""))throw new PlatformError("Use a six-digit brand color.");
   try{new Intl.DateTimeFormat("en",{timeZone:b.timezone});}catch{throw new PlatformError("Enter a valid IANA timezone.");}
   result=checked(await db.from("organizations").update({name:text(b.name,"Company name",100),logo_url:logo||null,brand_color:b.brand_color,welcome_message:text(b.welcome_message,"Welcome message",160,false),timezone:b.timezone}).eq("id",org).select().single());
  } else if(b.action==="sla") {
   await assertProperty(b.property_id);
   result=checked(await db.from("sla_policies").upsert({organization_id:org,property_id:b.property_id,department:text(b.department,"Department",80),response_minutes:number(Number(b.response_minutes),"Response minutes",1,10080),escalation_email:email(b.escalation_email)},{onConflict:"property_id,department"}).select().single());
  } else if(b.action==="schedule") {
   if(b.property_id&&b.property_id!=="all")await assertProperty(b.property_id);
   if(!["daily","weekly","monthly"].includes(b.frequency))throw new PlatformError("Invalid frequency.");
   result=checked(await db.from("report_schedules").insert({organization_id:org,created_by:user.id,name:text(b.name,"Report name",100),recipient_email:email(b.recipient_email),frequency:b.frequency,period_days:number(Number(b.period_days),"Period days",1,366),property_id:b.property_id&&b.property_id!=="all"?b.property_id:null}).select().single());
  } else if(b.action==="team_invitation") {
   const ids=Array.isArray(b.property_ids)?b.property_ids.slice(0,100):[];
   for(const id of ids)await assertProperty(id);
   const rights=Array.isArray(b.rights)?b.rights.filter((r:string)=>["view_feedback","manage_complaints","export_reports","manage_questionnaire","view_guest_pii"].includes(r)):["view_feedback","manage_complaints"];
   const token=newToken();
   result=checked(await db.from("team_invitations").insert({organization_id:org,email:email(b.email),token_hash:hashToken(token),invited_by:user.id,property_ids:ids,rights}).select("id,email,expires_at").single());
   result.link="/join/"+token;
  } else if(b.action==="api_key") {
   const token="vst_"+newToken(),scopes=Array.isArray(b.scopes)?b.scopes.filter((s:string)=>["feedback:read","reports:read"].includes(s)):["feedback:read"];
   if(!scopes.length)throw new PlatformError("Select at least one scope.");
   result=checked(await db.from("api_keys").insert({organization_id:org,name:text(b.name,"Key name",80),key_hash:hashToken(token),prefix:token.slice(0,12),scopes,created_by:user.id,expires_at:new Date(Date.now()+number(Number(b.days)||90,"Expiry days",1,365)*86400000).toISOString()}).select("id,name,prefix,scopes,expires_at").single());
   result.secret=token;
  } else if(b.action==="webhook") {
   const {validateDestination}=await import("../../../lib/platform/transport");
   const url=text(b.url,"Webhook URL",1000);await validateDestination(url);
   const secret=newToken();
   result=checked(await db.from("webhook_endpoints").insert({organization_id:org,url,secret_encrypted:encryptSecret(secret)}).select("id,url,is_active").single());
   result.secret=secret;
  } else if(b.action==="retry") {
   result=checked(await db.from("notification_outbox").select("id,status").eq("id",b.id).single());
   if(!["failed","blocked"].includes(result.status))throw new PlatformError("Only failed or blocked deliveries can be retried.");
   result=checked(await serviceDb().rpc("retry_workspace_job",{p_id:result.id,p_org:org}));
  } else throw new PlatformError("Unknown operation.");
 }
 await logAuditEvent({actorName:user.fullName,actorEmail:user.email,actorRole:user.role,action:b.action,category:"system",resource:"workspace",details:result.id||"Company settings updated"});
 return NextResponse.json({success:true,result});
});
export const DELETE=withWorkspace(async(request:NextRequest)=>{
 admin();
 const b=await request.json(),db=workspaceDb();
 const tables:Record<string,string>={view:"saved_views",schedule:"report_schedules",sla:"sla_policies",team:"team_invitations"};
 if(b.kind!=="view")admin();
 if(tables[b.kind])checked(await db.from(tables[b.kind]).delete().eq("id",b.id).select("id").single());
 else if(b.kind==="key")checked(await db.from("api_keys").update({revoked_at:new Date().toISOString()}).eq("id",b.id).select("id").single());
 else if(b.kind==="webhook")checked(await db.from("webhook_endpoints").update({is_active:false}).eq("id",b.id).select("id").single());
 else throw new PlatformError("Unknown resource.");
 return NextResponse.json({success:true});
});
