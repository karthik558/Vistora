const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),ts=require("typescript");
require.extensions[".ts"]=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021,esModuleInterop:true}}).outputText,file);
const {summarize,managementReport,csvCell}=require("../lib/platform/reports.ts");
const {newToken,hashToken,encryptSecret,decryptSecret}=require("../lib/platform/secrets.ts");
const {validateDestination}=require("../lib/platform/transport.ts");
const {hasModuleAccess,withModuleAssignments,effectiveModuleRights}=require("../lib/auth/modules.ts");
test("Explicit module grants can revoke feedback while preserving existing users and admin authority",()=>{
 const legacy=["view_feedback","manage_complaints"];
 assert.equal(hasModuleAccess({rights:legacy},"feedback"),true);
 assert.equal(hasModuleAccess({rights:legacy},"hospitality"),false);
 assert.ok(withModuleAssignments(legacy).includes("module:feedback"));
 assert.equal(hasModuleAccess({rights:["module:feedback"]},"feedback"),true);
 const hotelOnly=["module_access:configured","module:hospitality","view_feedback","manage_complaints","view_guest_pii"];
 assert.equal(hasModuleAccess({rights:hotelOnly},"feedback"),false);
 assert.equal(hasModuleAccess({rights:hotelOnly},"hospitality"),true);
 assert.deepEqual(effectiveModuleRights(hotelOnly,false),["module_access:configured","module:hospitality","view_guest_pii"]);
 assert.equal(hasModuleAccess({rights:[],isOrganizationAdmin:true},"hospitality"),true);
 assert.deepEqual(effectiveModuleRights(hotelOnly,true),hotelOnly);
 assert.equal(hasModuleAccess({rights:["module_access:configured"]},"feedback"),false);
});
const {canOpenTeam,canOpenSettings,canOpenProperties,canOpenWorkspace,isAdministrationPath}=require("../lib/auth/administration.ts");
test("Shared administration links preserve existing rights independently of module grants",()=>{
 for(const user of [null,{rights:[]},{rights:["module:hospitality"]},{rights:["module:feedback"]}]){
  assert.equal(canOpenTeam(user),false);assert.equal(canOpenSettings(user),false);
  assert.equal(canOpenProperties(user),false);assert.equal(canOpenWorkspace(user),false);
 }
 assert.equal(canOpenTeam({rights:["manage_users"]}),true);
 assert.equal(canOpenSettings({rights:["manage_settings"]}),false);
 assert.equal(canOpenTeam({isOrganizationAdmin:true}),true);
 assert.equal(canOpenSettings({isOrganizationAdmin:true}),true);
 assert.equal(canOpenProperties({isOrganizationAdmin:true}),true);
 assert.equal(canOpenWorkspace({isOrganizationAdmin:true}),true);
 assert.equal(canOpenProperties({rights:["manage_properties"]}),false);
 assert.equal(canOpenProperties({rights:["module:hospitality","manage_properties"]}),true);
 assert.equal(canOpenWorkspace({rights:["manage_settings","manage_users"]}),false);
 for(const path of ["/dashboard/users","/dashboard/settings","/dashboard/users/member","/dashboard/properties","/dashboard/workspace"])assert.equal(isAdministrationPath(path),true);
 for(const path of ["/dashboard/overview","/dashboard/hospitality","/dashboard/settings-other"])assert.equal(isAdministrationPath(path),false);
});
const {validateHospitality,DEFAULT_HOSPITALITY,moneyToMinor,accentTokens,themedAccentTokens,contrastRatio,workspaceForPath,sidebarTokens}=require("../lib/hospitality/config.ts");
test("Module routing preserves the hotel workspace on shared pages and distinguishes sidebar palettes",()=>{
 assert.equal(workspaceForPath("/dashboard/hospitality"),"operations");
 assert.equal(workspaceForPath("/dashboard/properties"),"operations");
 assert.equal(workspaceForPath("/dashboard/settings","operations"),"operations");
 assert.equal(workspaceForPath("/dashboard/overview"),"feedback");
 assert.equal(workspaceForPath("/dashboard/feedback"),"feedback");
 for(const dark of [false,true]){
  const green=sidebarTokens(DEFAULT_HOSPITALITY.colors.feedback,dark)["--workspace-sidebar"];
  const blue=sidebarTokens(DEFAULT_HOSPITALITY.colors.property,dark)["--workspace-sidebar"];
  assert.notEqual(green,blue);assert.ok(contrastRatio(green,"#c5d0db")>=4.5);assert.ok(contrastRatio(blue,"#c5d0db")>=4.5);
 }
});
test("Hotel configuration validates colors and budget precision without floating-point cost errors",()=>{
 assert.equal(moneyToMinor("19.99"),1999);assert.equal(moneyToMinor("0.01"),1);
 for(const value of ["-1","1e3","1.001","NaN"])assert.throws(()=>moneyToMinor(value));
 assert.throws(()=>validateHospitality({...DEFAULT_HOSPITALITY,colors:{...DEFAULT_HOSPITALITY.colors,feedback:"red"}}));
 assert.throws(()=>validateHospitality({...DEFAULT_HOSPITALITY,monthlyBudgetMinor:-1}));
 assert.throws(()=>validateHospitality({...DEFAULT_HOSPITALITY,inspectionChecklist:["Same","Same"]}));
 assert.equal(validateHospitality({}).alertsEnabled,false);
});
test("Custom section colors retain readable variants in light and dark mode",()=>{
 for(const hex of ["#ffffff","#000000","#00ff00","#243d6a"])for(const dark of [false,true]){
  const tokens=accentTokens(hex,dark);assert.ok(contrastRatio(tokens["--sage-deep"],dark?"#1c1f24":"#ffffff")>=4.5);assert.ok(contrastRatio(tokens["--module-accent"],tokens["--sage-soft"])>=4.5);assert.ok(contrastRatio(tokens["--module-accent"],dark?"#262a31":"#eef2ec")>=4.5);
 }
});
test("Server-rendered module palettes expose light and dark variants without waiting for client theme state",()=>{
 const palette=themedAccentTokens("#243d6a");
 assert.equal(palette["--palette-dark-sage-deep"],accentTokens("#243d6a",true)["--sage-deep"]);
 assert.equal(palette["--palette-light-sage-deep"],accentTokens("#243d6a",false)["--sage-deep"]);
 assert.notEqual(palette["--palette-dark-sage-deep"],palette["--palette-light-sage-deep"]);
});
const base={property_id:"one",department:"Front Desk",rating:5,recommendation_score:null,status:"under_review",assigned_to:null,category:"general",created_at:"2026-10-20T00:00:00Z",first_response_at:null,resolved_at:null,sla_deadline:null};
test("CSV escapes quotes and neutralizes spreadsheet formulas",()=>{assert.equal(csvCell('=HYPERLINK("https://example.com")'),'"\'=HYPERLINK(""https://example.com"")"');assert.equal(csvCell(-100),'"-100"');});
test("NPS uses genuine 0–10 answers, including zero; five-star history is excluded",()=>{
 const stats=summarize([null,0,6,7,8,9,10].map(recommendation_score=>({...base,recommendation_score})));
 assert.equal(stats.npsResponses,6);assert.equal(stats.promoters,2);assert.equal(stats.detractors,2);assert.equal(stats.nps,0);assert.equal(stats.averageRating,5);
 assert.equal(summarize([base]).nps,null);assert.equal(summarize([]).averageRating,null);
});
test("Current and previous report periods do not double-count the boundary",()=>{
 const report=managementReport([{...base,created_at:"2026-10-19T00:00:00Z"},{...base,created_at:"2026-10-12T00:00:00Z"},{...base,created_at:"2026-10-26T00:00:01Z"}],7,new Date("2026-10-26T00:00:00Z"));
 assert.equal(report.current.responses,1);assert.equal(report.previous.responses,1);
});
test("Response and resolution time reconcile with source timestamps",()=>{
 const stats=summarize([{...base,first_response_at:"2026-10-20T00:15:00Z",resolved_at:"2026-10-20T01:00:00Z"}]);
 assert.equal(stats.meanResponseMinutes,15);assert.equal(stats.meanResolutionMinutes,60);
});
test("Invitation tokens are unique and secrets use authenticated encryption",()=>{
 process.env.WORKSPACE_ENCRYPTION_KEY="ab".repeat(32);
 const a=newToken(),b=newToken();assert.notEqual(a,b);assert.equal(hashToken(a).length,64);
 const encrypted=encryptSecret(a);assert.ok(!encrypted.includes(a));assert.equal(decryptSecret(encrypted),a);
 const tampered=encrypted.slice(0,-2)+(encrypted.endsWith("aa")?"bb":"aa");assert.throws(()=>decryptSecret(tampered));
});
test("Private, loopback, metadata, IPv6 and insecure webhook destinations are rejected",async()=>{
 for(const url of ["http://example.com","https://127.0.0.1","https://10.0.0.1","https://169.254.169.254","https://[::1]","https://[::ffff:127.0.0.1]","https://example.com:444","https://user:pass@example.com"])await assert.rejects(validateDestination(url),undefined,url);
});
test("Webhook signatures bind the timestamp and exact body, with pinned DNS",async()=>{
 const https=require("node:https"),crypto=require("node:crypto"),original=https.request;
 const {sendSigned}=require("../lib/platform/transport.ts");let captured;
 https.request=(url,options,respond)=>{
  captured=options;
  return {setTimeout(){},on(){},end(body){captured.body=body;respond({statusCode:202,resume(){}});}};
 };
 try{
  assert.equal(await sendSigned("https://8.8.8.8/events",{hello:"world"},"secret","delivery-1"),202);
  const h=captured.headers,expected=crypto.createHmac("sha256","secret").update(h["X-Vistora-Timestamp"]+"."+captured.body).digest("hex");
  assert.equal(h["X-Vistora-Signature"],"v1="+expected);assert.equal(h["Idempotency-Key"],"delivery-1");
  captured.lookup("ignored",{},(err,address)=>{assert.equal(err,null);assert.equal(address,"8.8.8.8");});
 }finally{https.request=original;}
});
test("Worker records blocked providers, cancels resolved alerts, and queues retry on provider failure",async()=>{
 const db=require("../lib/platform/db.ts"),email=require("../lib/platform/email.ts"),{runWorker}=require("../lib/platform/worker.ts");
 const originalDb=db.serviceDb,originalSend=email.sendEmail,env={...process.env};
 let caseStatus="under_review",finished;
 const job={id:"job",organization_id:"org",kind:"sla",payload:{feedbackId:"case",recipient:"ops@example.com"},lease_token:"lease"};
 db.serviceDb=()=>({
  async rpc(name,args){if(name==="claim_workspace_jobs")return{data:[job],error:null};if(name==="finish_workspace_job"){finished=args;return{data:true,error:null};}return{data:0,error:null};},
  from(table){const q={select(){return q;},eq(){return q;},async maybeSingle(){return{data:{status:caseStatus},error:null};},async single(){return{data:{status:finished.p_status==="retry"?"queued":finished.p_status},error:null};}};return q;}
 });
 for(const key of ["RESEND_API_KEY","MAIL_FROM","DELIVERY_WEBHOOK_URL","DELIVERY_WEBHOOK_SECRET"])delete process.env[key];
 try{
  assert.equal((await runWorker("org"))[0].status,"blocked");assert.equal(finished.p_lease,"lease");
  caseStatus="resolved";assert.equal((await runWorker("org"))[0].status,"failed");
  caseStatus="under_review";process.env.RESEND_API_KEY="test";process.env.MAIL_FROM="ops@example.com";
  email.sendEmail=async()=>{throw new Error("Provider unavailable");};
  assert.equal((await runWorker("org"))[0].status,"queued");assert.equal(finished.p_status,"retry");
 }finally{db.serviceDb=originalDb;email.sendEmail=originalSend;for(const key of Object.keys(process.env))if(!(key in env))delete process.env[key];Object.assign(process.env,env);}
});
test("Workspace API rejects unassigned hotel access; admin configuration and report permission remain separate",async()=>{
 const db=require("../lib/platform/db.ts"),{NextRequest}=require("next/server");
 const workspace=require("../app/api/platform/route.ts"),reports=require("../app/api/reports/workspace/route.ts"),hotel=require("../app/api/hospitality/route.ts"),settings=require("../app/api/settings/route.ts");
 const originalSession=db.sessionDb;
 const user={id:"member",organizationId:"company",isOrganizationAdmin:false,accessToken:"verified",rights:["view_feedback","manage_complaints","manage_settings","manage_users","export_reports"],role:"staff"};
 const client={from(){throw new Error("Unauthorized request reached the database");}};
 db.sessionDb=()=>client;
 try{
  for(const method of ["GET","POST","DELETE"]){
   const request=new NextRequest("http://localhost/api/platform",{method,...(method==="GET"?{}:{headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"save_view",kind:"view"})})});
   const response=await db.workspaceContext.run({user,client},()=>workspace[method](request));
   assert.equal(response.status,403,method+" must require company administrator membership");
  }
  const response=await db.workspaceContext.run({user:{...user,rights:[]},client},()=>reports.GET(new NextRequest("http://localhost/api/reports/workspace")));
  assert.equal(response.status,403,"Report data still requires export_reports");
  for(const method of ["GET","POST","PATCH"]){
   const denied=await db.workspaceContext.run({user,client},()=>hotel[method](new NextRequest("http://localhost/api/hospitality",{method,...(method==="GET"?{}:{headers:{"Content-Type":"application/json"},body:"{}"})})));
   assert.equal(denied.status,403,"Unassigned hotel access must be denied: "+method);
  }
  const settingsDenied=await db.workspaceContext.run({user,client},()=>settings.GET(new NextRequest("http://localhost/api/settings")));
  assert.equal(settingsDenied.status,403,"Configuration must be admin-only even with manage_settings");
 }finally{db.sessionDb=originalSession;}
});
test("Assigned hotel staff receive a read-only payload without financial or configuration queries",async()=>{
 const db=require("../lib/platform/db.ts"),hotel=require("../app/api/hospitality/route.ts"),{NextRequest}=require("next/server");
 const queried=[];
 let granted=true;
 const client={rpc:async()=>({data:granted,error:null}),from(table){
  queried.push(table);let head=false;
  const query={select(_fields,options){head=!!options?.head;return query;},eq(){return query;},in(){return query;},not(){return query;},order(){return query;},limit(){return query;},then(resolve){resolve({data:head?null:[],count:0,error:null});}};
  return query;
 }};
 const user={id:"staff",organizationId:"company",isOrganizationAdmin:false,accessToken:"verified",rights:["module_access:configured","module:hospitality"],role:"staff"};
 const original=db.sessionDb;db.sessionDb=()=>client;
 try{
  const response=await db.workspaceContext.run({user,client},()=>hotel.GET(new NextRequest("http://localhost/api/hospitality")));
  assert.equal(response.status,200);const payload=await response.json();
  assert.equal(payload.canManage,false);assert.equal(payload.budget,null);assert.deepEqual(payload.costs,[]);assert.deepEqual(payload.guests,[]);
  assert.ok(!queried.some(table=>["operating_costs","organization_settings","hotel_activity","guests"].includes(table)));
  for(const method of ["POST","PATCH"]){const denied=await db.workspaceContext.run({user,client},()=>hotel[method](new NextRequest("http://localhost/api/hospitality",{method,body:"{}"})));assert.equal(denied.status,403);}
  granted=false;
  const denied=await db.workspaceContext.run({user,client},()=>hotel.GET(new NextRequest("http://localhost/api/hospitality")));
  assert.equal(denied.status,403,"A revoked database module grant must override stale client/session state");
 }finally{db.sessionDb=original;}
});
test("Member access cannot be saved before the module database policies are installed",async()=>{
 const db=require("../lib/platform/db.ts"),users=require("../app/api/users/route.ts"),{NextRequest}=require("next/server");
 const client={rpc:async()=>({data:null,error:{code:"PGRST202",message:"Function missing"}}),from(){throw new Error("Profile access occurred before the schema check");}};
 const user={id:"admin",organizationId:"company",isOrganizationAdmin:true,accessToken:"verified",rights:[],role:"admin"};
 const original=db.sessionDb;db.sessionDb=()=>client;
 try{
  for(const method of ["POST","PATCH"]){
   const response=await db.workspaceContext.run({user,client},()=>users[method](new NextRequest("http://localhost/api/users",{method,headers:{"Content-Type":"application/json"},body:JSON.stringify({userId:"target",email:"member@test.local",fullName:"Test member",password:"test-password-only"})})));
   assert.equal(response.status,503);assert.match((await response.json()).error,/section 25/);
  }
 }finally{db.sessionDb=original;}
});
test("Role mapping API denies every operation to non-admin staff",async()=>{
 const db=require('../lib/platform/db.ts'),route=require('../app/api/role-mappings/route.ts'),{NextRequest}=require('next/server');
 const original=db.sessionDb,client={from(){throw new Error('Unauthorized database access');}};
 db.sessionDb=()=>client;
 const user={id:'staff',organizationId:'org',isOrganizationAdmin:false,rights:['manage_users','manage_settings'],accessToken:'verified'};
 try{for(const method of ['GET','POST','PATCH','DELETE']){
  const response=await db.workspaceContext.run({user,client},()=>route[method](new NextRequest('http://localhost/api/role-mappings',{method,...(method==='GET'?{}:{body:'{}'})})));
  assert.equal(response.status,403);
 }}finally{db.sessionDb=original;}
});
test("Role mapping returns a specific migration notice when the connected database is not upgraded",async()=>{
 const db=require('../lib/platform/db.ts'),route=require('../app/api/role-mappings/route.ts'),{NextRequest}=require('next/server');
 const original=db.sessionDb;
 const client={from(table){const q={select(){return q;},eq(){return q;},order(){return q;},then(resolve){resolve(table==='role_mappings'?{error:{code:'PGRST205'}}:{data:[],error:null});}};return q;}};
 db.sessionDb=()=>client;
 try{const response=await db.workspaceContext.run({user:{isOrganizationAdmin:true,organizationId:'org'},client},()=>route.GET(new NextRequest('http://localhost/api/role-mappings')));assert.equal(response.status,503);assert.match((await response.json()).error,/20261027_role_mapping.sql/);}finally{db.sessionDb=original;}
});
test("Public feedback rejects invalid scores and missing required answers before submission",async()=>{
 const db=require('../lib/platform/db.ts'),route=require('../app/api/feedback/route.ts'),{NextRequest}=require('next/server');
 const original=db.serviceDb;
 const client={from(table){const q={select(){return q;},eq(){return q;},or(){return q;},maybeSingle:async()=>({data:{id:'hotel',organization_id:'org'},error:null}),then(resolve){resolve({data:[{id:'required',question_type:'text',question_text:'Required QA',is_required:true}],error:null});}};return q;}};
 db.serviceDb=()=>client;
 try{
  for(const rating of [0,6,2.5,'3']){const response=await route.POST(new NextRequest('http://localhost/api/feedback',{method:'POST',body:JSON.stringify({propertyId:'hotel',department:'Front Desk',rating})}));assert.equal(response.status,400);assert.match((await response.json()).error,/Rating/);}
  const response=await route.POST(new NextRequest('http://localhost/api/feedback',{method:'POST',body:JSON.stringify({propertyId:'hotel',department:'Front Desk',rating:3})}));assert.equal(response.status,400);assert.match((await response.json()).error,/required questions/);
 }finally{db.serviceDb=original;}
});
test("Role mapping edits are scoped to the session company and reject duplicate scopes",async()=>{
 const db=require('../lib/platform/db.ts'),route=require('../app/api/role-mappings/route.ts'),{NextRequest}=require('next/server');
 const original=db.sessionDb;let row,filters=[],duplicate=false;
 const client={from(){const q={update(value){row=value;return q;},insert(value){row=value;return q;},eq(key,value){filters.push([key,value]);return q;},select(){return q;},single:async()=>duplicate?{data:null,error:{code:'23505'}}:{data:{id:'rule'},error:null}};return q;}};
 db.sessionDb=()=>client;
 const user={isOrganizationAdmin:true,organizationId:'company'};
 const request=method=>new NextRequest('http://localhost/api/role-mappings',{method,body:JSON.stringify({id:'rule',organization_id:'other-company',module:'feedback',country:'India',role_name:'Duty manager',assignee_id:'member',max_rating:3})});
 try{
  const response=await db.workspaceContext.run({user,client},()=>route.PATCH(request('PATCH')));assert.equal(response.status,200);assert.equal(row.organization_id,'company');assert.deepEqual(filters,[['id','rule'],['organization_id','company']]);
  duplicate=true;const conflict=await db.workspaceContext.run({user,client},()=>route.POST(request('POST')));assert.equal(conflict.status,409);
 }finally{db.sessionDb=original;}
});
test("SLA compliance uses recorded responses and deadlines, including rating 3 and overdue resolved cases",()=>{
 const {responseCompliance}=require('../lib/feedback/sla.ts'),now=Date.parse('2026-10-27T12:00:00Z');
 const row={rating:3,status:'needs_attention',deadline:'2026-10-27T11:00:00Z',firstResponseAt:null};
 const result=responseCompliance([row,{...row,firstResponseAt:'2026-10-27T10:59:00Z'},{...row,status:'resolved',firstResponseAt:'2026-10-27T11:01:00Z'},{...row,deadline:'2026-10-27T13:00:00Z'},{...row,rating:5},{...row,deadline:null}],now);
 assert.equal(result.evaluated,3);assert.equal(result.rate,33);assert.equal(result.nextDeadline,'2026-10-27T11:00:00.000Z');
 assert.equal(responseCompliance([{...row,deadline:'2026-10-27T13:00:00Z'}],now).rate,null);
});
