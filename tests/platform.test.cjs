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
   const request=new NextRequest("http://localhost/api/platform",{method,...(method==="GET"?{}:{headers: {"Content-Type":"application/json"}, body: JSON.stringify({action:"save_view",kind:"view"})})});
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
  for(const method of ["POST","PATCH"]){const denied=await db.workspaceContext.run({user,client},()=>hotel[method](new NextRequest("http://localhost/api/hospitality",{method,headers:{"Content-Type":"application/json"},body:"{}"})));assert.equal(denied.status,403);}
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
   const response=await db.workspaceContext.run({user,client},()=>users[method](new NextRequest("http://localhost/api/users",{method,headers: {"Content-Type":"application/json"}, body: JSON.stringify({userId:"target",email:"member@test.local",fullName:"Test member",password:"test-password-only"})})));
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
 const {createPropertyFeedbackToken}=require("../lib/feedback/public-links.ts");
 const token=createPropertyFeedbackToken({propertyId:"hotel",room:"",department:"",demo:false});
 const client={from(table){const q={select(){return q;},eq(){return q;},or(){return q;},order(){return q;},is(){return q;},maybeSingle:async()=>({data:{id:'hotel',organization_id:'org'},error:null}),then(resolve){resolve({data:[{id:'required',question_type:'text',question_text:'Required QA',is_required:true}],error:null});}};return q;}};
 db.serviceDb=()=>client;
 try{
  for(const rating of [0,6,2.5,'3']){const response=await route.POST(new NextRequest('http://localhost/api/feedback',{method:'POST',headers: {"Content-Type":"application/json"}, body: JSON.stringify({publicToken:token,propertyId:'hotel',department:'Front Desk',rating})}));assert.equal(response.status,400);assert.match((await response.json()).error,/Rating/);}
  const response=await route.POST(new NextRequest('http://localhost/api/feedback',{method:'POST',headers: {"Content-Type":"application/json"}, body: JSON.stringify({publicToken:token,propertyId:'hotel',department:'Front Desk',rating:3})}));assert.equal(response.status,400);assert.match((await response.json()).error,/required questions/);
 }finally{db.serviceDb=original;}
});
test("Role mapping edits are scoped to the session company and reject duplicate scopes",async()=>{
 const db=require('../lib/platform/db.ts'),route=require('../app/api/role-mappings/route.ts'),{NextRequest}=require('next/server');
 const original=db.sessionDb;let row,filters=[],duplicate=false;
 const client={from(){const q={update(value){row=value;return q;},insert(value){row=value;return q;},eq(key,value){filters.push([key,value]);return q;},select(){return q;},single:async()=>duplicate?{data:null,error:{code:'23505'}}:{data:{id:'rule'},error:null}};return q;}};
 db.sessionDb=()=>client;
 const user={isOrganizationAdmin:true,organizationId:'company'};
 const request=method=>new NextRequest('http://localhost/api/role-mappings',{method,headers: {"Content-Type":"application/json"}, body: JSON.stringify({id:'rule',organization_id:'other-company',module:'feedback',country:'India',role_name:'Duty manager',assignee_id:'member',max_rating:3})});
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
test("Operational write permission requires both the hotel module and the explicit service-work right",()=>{
 const {canManageServiceJobs}=require('../lib/operations/access.ts');
 assert.equal(canManageServiceJobs({rights:['module:hospitality']}),false);
 assert.equal(canManageServiceJobs({rights:['manage_service_jobs']}),false);
 assert.equal(canManageServiceJobs({rights:['module:hospitality','manage_service_jobs']}),true);
 assert.equal(canManageServiceJobs({isOrganizationAdmin:true,rights:[]}),true);
});
test("Complaint API routes issues to their catalogue department and delegates authorization to the transactional RPC",async()=>{
 const db=require('../lib/platform/db.ts'),route=require('../app/api/hospitality/route.ts'),{NextRequest}=require('next/server');const original=db.sessionDb;let saved;
 const client={rpc:async(name,args)=>{if(name==='complaint_schema_ready')return {data:true,error:null};assert.equal(name,'submit_service_complaint');saved=args.p_complaint;return {data:'complaint-id',error:null};},from(){throw new Error('Intake bypassed the protected RPC');}};
 const user={id:'reporter',organizationId:'org',isOrganizationAdmin:false,rights:['module:hospitality','manage_service_jobs']};db.sessionDb=()=>client;
 try{
  const response=await db.workspaceContext.run({user,client},()=>route.POST(new NextRequest('http://localhost/api/hospitality',{method:'POST',headers: {"Content-Type":"application/json"}, body: JSON.stringify({action:'complaint',property_id:'hotel',issue_type:'wifi',department:'Engineering',location:'Room 101'})})));
  assert.equal(response.status,201);assert.equal(saved.department,'IT');assert.equal(saved.issue_type,'wifi');assert.equal(saved.location,'Room 101');
  const denied=await db.workspaceContext.run({user:{...user,rights:['module:hospitality']},client},()=>route.POST(new NextRequest('http://localhost/api/hospitality',{method:'POST',headers: {"Content-Type":"application/json"}, body: JSON.stringify({action:'complaint'})})));assert.equal(denied.status,403);
 }finally{db.sessionDb=original;}
});
test("Assignment delivery resolves the current authorized owner's email and cancels stale ownership",async()=>{
 const db=require('../lib/platform/db.ts'),email=require('../lib/platform/email.ts'),{runWorker}=require('../lib/platform/worker.ts');
 const originalDb=db.serviceDb,originalSend=email.sendEmail,env={...process.env};let owner='junior',finished,sent,eligible=true;
 const job={id:'assignment',organization_id:'org',kind:'role_assignment',lease_token:'lease',payload:{module:'hospitality',recordId:'case',assignedUserId:'junior',level:0,cycle:'cycle'}};
 db.serviceDb=()=>({rpc:async(name,args)=>{if(name==='claim_workspace_jobs')return {data:[job],error:null};if(name==='role_member_eligible')return {data:eligible,error:null};if(name==='finish_workspace_job'){finished=args;return {data:true,error:null};}return {data:0,error:null};},from(table){const q={select(){return q;},eq(){return q;},maybeSingle:async()=>({data:{status:'open',assigned_to:owner,escalation_level:0,routing_cycle:'cycle',property_id:'hotel',department:'IT'},error:null}),single:async()=>({data:table==='profiles'?{email:'junior@example.test'}:{status:finished.p_status},error:null})};return q;}});
 process.env.RESEND_API_KEY='test';process.env.MAIL_FROM='ops@example.test';email.sendEmail=async(kind,payload)=>{sent={kind,payload};return 202;};
 try{
  assert.equal((await runWorker('org'))[0].status,'delivered');assert.equal(sent.payload.recipient,'junior@example.test');assert.equal(sent.kind,'role_assignment');
  sent=null;owner='senior';assert.equal((await runWorker('org'))[0].status,'failed');assert.equal(sent,null);
  owner='junior';eligible=false;assert.equal((await runWorker('org'))[0].status,'failed');assert.equal(sent,null);
 }finally{db.serviceDb=originalDb;email.sendEmail=originalSend;for(const key of Object.keys(process.env))if(!(key in env))delete process.env[key];Object.assign(process.env,env);}
});

test("Operations department controls require the service-work grant and an eligible department",()=>{
 const {canOperateDepartment}=require("../lib/operations/access.ts");
 const staff={rights:["module:hospitality","module_access:configured","manage_service_jobs","dept_scope:Housekeeping"]};
 assert.equal(canOperateDepartment(staff,"Housekeeping"),true);
 assert.equal(canOperateDepartment(staff,"Engineering"),false);
 assert.equal(canOperateDepartment({rights:["module:hospitality"]},"Housekeeping"),false);
 assert.equal(canOperateDepartment({isOrganizationAdmin:true},"Engineering"),true);
 assert.throws(()=>validateHospitality({callRateMinor:-1}));
 assert.throws(()=>validateHospitality({callRateMinor:1.5}));
});
test("Private guest-link generation returns the same valid token on an idempotent retry",async()=>{
 const db=require("../lib/platform/db.ts"),{NextRequest}=require("next/server"),operations=require("../app/api/operations/route.ts"),{createHash}=require("node:crypto");
 const prior=db.sessionDb,secret=process.env.GUEST_LINK_SECRET;process.env.GUEST_LINK_SECRET="test-only-guest-link-secret";
 const commands=[],client={rpc:async(name,args)=>name==="omniops_ready"?{data:true,error:null}:(commands.push(args),{data:{id:"created-link"},error:null})};
 const user={id:"11111111-1111-4111-8111-111111111111",organizationId:"22222222-2222-4222-8222-222222222222",isOrganizationAdmin:true,accessToken:"verified",rights:[],role:"admin"};
 db.sessionDb=()=>client;
 const body={action:"guest_link",requestId:"33333333-3333-4333-8333-333333333333",data:{property_id:"44444444-4444-4444-8444-444444444444",stay_id:"55555555-5555-4555-8555-555555555555"}};
 try{
  const send=()=>db.workspaceContext.run({user,client},()=>operations.POST(new NextRequest("http://localhost/api/operations",{method:"POST",headers: {"Content-Type":"application/json"}, body: JSON.stringify(body)})));
  const one=await send(),two=await send();assert.equal(one.status,200);assert.equal(two.status,200);const a=await one.json(),b=await two.json();assert.equal(a.path,b.path);
  const token=a.path.split("/").pop();assert.match(token,/^[A-Za-z0-9_-]{43}$/);assert.equal(createHash("sha256").update(token).digest("hex"),commands[0].p_data.token_hash);assert.equal(commands[0].p_data.token_hash,commands[1].p_data.token_hash);
 }finally{db.sessionDb=prior;if(secret===undefined)delete process.env.GUEST_LINK_SECRET;else process.env.GUEST_LINK_SECRET=secret;}
});
test("Push subscription endpoints reject SSRF destinations before using server credentials",async()=>{
 const db=require("../lib/platform/db.ts"),{NextRequest}=require("next/server"),push=require("../app/api/operations/push/route.ts");
 const prior=db.sessionDb,priorService=db.serviceDb;const client={};db.sessionDb=()=>client;db.serviceDb=()=>{throw new Error("Invalid endpoint reached the service client");};
 const user={id:"member",organizationId:"company",isOrganizationAdmin:false,accessToken:"verified",rights:["module:hospitality","module_access:configured","manage_service_jobs"],role:"staff"};
 try{for(const endpoint of ["http://127.0.0.1/", "https://169.254.169.254/", "https://evil.example/", "https://fcm.googleapis.com.evil.example/", "https://fcm.googleapis.com:8443/", "https://user:pass@fcm.googleapis.com/"]){const response=await db.workspaceContext.run({user,client},()=>push.POST(new NextRequest("http://localhost/api/operations/push",{method:"POST",headers: {"Content-Type":"application/json"}, body: JSON.stringify({endpoint,keys:{auth:"a".repeat(24),p256dh:"b".repeat(88)}})})));assert.equal(response.status,400,endpoint);}}
 finally{db.sessionDb=prior;db.serviceDb=priorService;}
});

test("Inspection photo uploads reject oversized streams before parsing or storage writes",async()=>{
 const db=require("../lib/platform/db.ts"),{NextRequest}=require("next/server"),evidence=require("../app/api/operations/evidence/route.ts");
 const prior=db.sessionDb,client={rpc(){throw new Error("Oversized upload reached the database");}};
 db.sessionDb=()=>client;const user={id:"owner",organizationId:"company",isOrganizationAdmin:true,accessToken:"verified",rights:[],role:"admin"};
 try{const response=await db.workspaceContext.run({user,client},()=>evidence.POST(new NextRequest("http://localhost/api/operations/evidence",{method:"POST",headers:{"Content-Type":"multipart/form-data; boundary=test"},body:new Uint8Array(5500001)})));assert.equal(response.status,413);}
 finally{db.sessionDb=prior;}
});

const {validateAnswers,toggleMultiChoice,multiChoices}=require('../lib/feedbackAnswers.ts');
test('Questionnaires retain multiple choices and reject invalid or contradictory answers before persistence',()=>{
 const q=[{id:'multi',question_text:'Services',question_type:'multi_choice',is_required:true,options:['Pool','Spa']},{id:'nps',question_text:'Recommend',question_type:'nps',is_required:false},{id:'rating',question_text:'Room',question_type:'rating',is_required:false}];
 let value=toggleMultiChoice('','Pool');value=toggleMultiChoice(value,'Spa');assert.deepEqual(multiChoices(value),['Pool','Spa']);
 assert.equal(validateAnswers(q,[{questionId:'multi',answerValue:value}],null).answers[0].answerValue,value);
 value=toggleMultiChoice(value,'Pool');assert.deepEqual(multiChoices(value),['Spa']);assert.equal(toggleMultiChoice(value,'Spa'),'');
 const valid={questionId:'multi',answerValue:'["Pool"]'};
 for(const bad of ['["Unknown"]','["Pool","Pool"]','[]','Pool'])assert.throws(()=>validateAnswers(q,[{questionId:'multi',answerValue:bad}],null));
 assert.throws(()=>validateAnswers(q,[valid,valid],null));
 assert.throws(()=>validateAnswers(q,[valid,{questionId:'rating',answerValue:'9/5'}],null));
 assert.throws(()=>validateAnswers(q,[valid,{questionId:'nps',answerValue:'9'}],3));
 assert.equal(validateAnswers(q,[valid,{questionId:'nps',answerValue:'0'}],null).recommendationScore,0);
 assert.throws(()=>validateAnswers(q,[],null));
 assert.throws(()=>validateAnswers(q,[valid],3.5));
 assert.throws(()=>validateAnswers(q,[valid,{questionId:'foreign',answerValue:'yes'}],null));
 for(const type of ['choice','dropdown','emoji','touchpoint','yes_no'])assert.throws(()=>validateAnswers([{...q[0],question_type:type}],[{questionId:'multi',answerValue:'impossible'}],null));
});
const {integrationStatus}=require('../lib/platform/integrationStatus.ts');
test('Integration setup exposes only readiness and variable names, never secrets or unverified delivery claims',()=>{
 const env={APP_URL:'https://hotel.example',WORKSPACE_ENCRYPTION_KEY:'a'.repeat(64),WORKSPACE_CRON_SECRET:'private-cron',RESEND_API_KEY:'private-provider',MAIL_FROM:'Hotel <service@example.com>',DELIVERY_WEBHOOK_URL:'https://adapter.example/events',DELIVERY_WEBHOOK_SECRET:'private-signing'};
 const result=integrationStatus(env);assert.ok(result.every(s=>s.configured));
 for(const secret of ['private-cron','private-provider','private-signing',env.WORKSPACE_ENCRYPTION_KEY])assert.ok(!JSON.stringify(result).includes(secret));
 assert.ok(integrationStatus({}).every(s=>!s.configured));
 assert.equal(integrationStatus({...env,DELIVERY_WEBHOOK_URL:'http://adapter.example'})[3].configured,false);
 assert.equal(integrationStatus({...env,WORKSPACE_ENCRYPTION_KEY:'invalid'})[1].configured,false);
});
const {pagedRows}=require('../lib/platform/pagedRows.ts');
test('Paged feedback reads survive a server row cap and fail rather than returning incomplete totals',async()=>{
 const records=Array.from({length:1203},(_,id)=>({id})),offsets=[];
 const result=await pagedRows({range:async(start,end)=>{offsets.push(start);return {data:records.slice(start,Math.min(end+1,start+100)),error:null};}});
 assert.deepEqual(result,records);assert.equal(offsets.at(-1),1203);
 await assert.rejects(()=>pagedRows({range:async()=>({data:null,error:{message:'denied'}})}),/denied/);
});

test('Daily guest report parser extracts records and normalizes arrival dates', () => {
 const { parseGuestReportCsv } = require('../lib/hospitality/guestReportParser.ts');
 const csv = `Guest Name,Email,Phone,Room No,Check-in,Check-out,Pax,VIP Tier,Preferences
"Doe, John",john@example.com,+1 555-0199,101,2026-11-03,2026-11-06,2,VIP,Sea view
Eleanor Vance,eleanor@example.co.uk,+44 7700 900111,204,2026-11-04,2026-11-08,1,NC / Complimentary,VIP amenity`;
 const records = parseGuestReportCsv(csv);
 assert.equal(records.length, 2);
 assert.equal(records[0].guest_name, "Doe, John");
 assert.equal(records[0].room_number, "101");
 assert.equal(records[0].guest_count, 2);
 assert.equal(records[0].vip_tier, "VIP");
 assert.equal(records[1].guest_name, "Eleanor Vance");
 assert.equal(records[1].room_number, "204");
 assert.equal(records[1].vip_tier, "NC / Complimentary");
});

test('Daily import API requires authorization, scopes one property and requires review before commit', async () => {
 const db = require('../lib/platform/db.ts');
 const route = require('../app/api/hospitality/import/route.ts');
 const { NextRequest } = require('next/server');
 const calls = [];
 const client = { rpc: async (name, args) => { calls.push({ name, args }); return { data: { success: true, preview: !args.p_preview_token }, error: null }; } };
 const original = db.sessionDb;
 db.sessionDb = () => client;
 const staff = { id: 'staff', organizationId: 'org', isOrganizationAdmin: false, rights: ['module:hospitality', 'import_guests'], propertyIds: ['prop-1'] };
 const body = { property_id: 'prop-1', request_id: 'request-1', mode: 'partial', records: [{ guest_name: 'Test', room_number: '101' }] };
 const post = (user, data) => db.workspaceContext.run({ user, client }, () => route.POST(new NextRequest('http://localhost/api/hospitality/import', { method: 'POST', headers: {"Content-Type":"application/json"}, body: JSON.stringify(data) })));
 try {
  assert.equal((await post({ ...staff, rights: ['module:hospitality'] }, body)).status, 403);
  assert.equal((await post(staff, { ...body, property_id: 'prop-2' })).status, 403);
  assert.equal((await post(staff, { ...body, commit: true })).status, 400);
  assert.equal(calls.length, 0);
  assert.equal((await post(staff, body)).status, 200);
  assert.equal(calls[0].name, 'import_guest_report');
  assert.equal(calls[0].args.p_property, 'prop-1');
  assert.equal(calls[0].args.p_preview_token, null);
  assert.equal((await post(staff, { ...body, commit: true, preview_token: 'review-token' })).status, 200);
  assert.equal(calls[1].args.p_preview_token, 'review-token');
 } finally { db.sessionDb = original; }
});

test("Super admin accounts are hidden and property access is strictly scoped for hotel admins", async () => {
 const db = require("../lib/platform/db.ts");
 const { NextRequest } = require("next/server");
 const original = db.sessionDb;
 try {
  const usersRoute = require("../app/api/users/route.ts");
  const mockProfiles = [
   { id: "owner-1", full_name: "Super Boss", email: "boss@vistora.com", role: "super_admin", rights: ["org_role:super_admin"], property_ids: [] },
   { id: "hotel-admin-1", full_name: "Hotel Admin", email: "hotel1@vistora.com", role: "admin", rights: ["org_role:admin", "manage_users"], property_ids: ["prop-1"] },
   { id: "hotel-admin-2", full_name: "Other Hotel Admin", email: "hotel2@vistora.com", role: "admin", rights: ["org_role:admin", "manage_users"], property_ids: ["prop-2"] },
  ];
  const mockMembers = [
   { user_id: "owner-1", role: "owner", is_active: true },
   { user_id: "hotel-admin-1", role: "member", is_active: true },
   { user_id: "hotel-admin-2", role: "member", is_active: true },
  ];

  const client = {
   from: (table) => ({
    select: () => ({
     eq: () => ({
      data: mockMembers,
      error: null,
     }),
     in: () => ({
      order: () => ({
       data: mockProfiles,
       error: null,
      }),
     }),
    }),
   }),
  };
  db.sessionDb = () => client;

  const hotelAdminUser = {
   id: "hotel-admin-1",
   fullName: "Hotel Admin",
   email: "hotel1@vistora.com",
   role: "admin",
   orgRole: "admin",
   organizationId: "org",
   isOrganizationAdmin: false,
   propertyIds: ["prop-1"],
   propertyId: "prop-1",
   rights: ["manage_users"],
   accessToken: "verified",
  };

  const res = await db.workspaceContext.run({ user: hotelAdminUser, client }, () =>
   usersRoute.GET(new NextRequest("http://localhost/api/users"))
  );
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  // Super admin must be completely hidden
  assert.equal(data.users.some(u => u.role === "super_admin" || u.email === "boss@vistora.com"), false);
  // Other properties must be filtered out for single property admin
  assert.equal(data.users.some(u => u.id === "hotel-admin-2"), false);
  // Self / assigned property admin is present
  assert.equal(data.users.some(u => u.id === "hotel-admin-1"), true);

  // Non-superadmin cannot create super_admin
  const createSuperRes = await db.workspaceContext.run({ user: hotelAdminUser, client }, () =>
   usersRoute.POST(
    new NextRequest("http://localhost/api/users", {
     method: "POST",
     headers: {"Content-Type":"application/json"}, body: JSON.stringify({
      fullName: "Attacker Super Admin",
      email: "attacker@vistora.com",
      password: "StrongPassword123!",
      role: "super_admin",
     }),
    })
   )
  );
  assert.equal(createSuperRes.status, 403);
  const createErr = await createSuperRes.json();
  assert.match(createErr.error, /super administrator/i);
 } finally {
  db.sessionDb = original;
 }
});
test("Granular view vs manage rights enforce read-only and write boundaries",async()=>{
 const db=require("../lib/platform/db.ts"),{NextRequest}=require("next/server");
 const roleRoute=require("../app/api/role-mappings/route.ts");
 const settingsRoute=require("../app/api/settings/route.ts");
 const {canOpenRoleMapping,canOpenProperties,canOpenTeam,canOpenSettings}=require("../lib/auth/administration.ts");

 // 1. Administration open checks
 assert.equal(canOpenRoleMapping({rights:["view_role_mapping"]}),true);
 assert.equal(canOpenRoleMapping({rights:["manage_role_mapping"]}),true);
 assert.equal(canOpenRoleMapping({rights:["view_feedback"]}),false);
 assert.equal(canOpenProperties({rights:["module:hospitality","view_properties"]}),true);
 assert.equal(canOpenTeam({rights:["view_users"]}),true);
 assert.equal(canOpenSettings({rights:["view_settings"]}),true);

 // 2. Role mappings route checks
 const viewOnlyUser={id:"viewer",organizationId:"org",isOrganizationAdmin:false,rights:["view_role_mapping"],accessToken:"verified"};
 const originalSession=db.sessionDb;
 const mockClient={
  from(table){
   const q={
    select(){return q;},
    eq(){return q;},
    order(){return q;},
    in(){return q;},
    then(resolve){
     if(table==="role_mappings")resolve({data:[{id:"r1",role_name:"Duty IT",module:"hospitality",property_id:null,country:"",department:"IT",assignee_id:"user-1",response_minutes:15,max_rating:3,is_active:true}],error:null});
     else if(table==="properties")resolve({data:[{id:"p1",name:"Bangkok Resort",country:"Thailand",is_active:true}],error:null});
     else if(table==="organization_members")resolve({data:[{user_id:"user-1",role:"member",is_active:true}],error:null});
     else if(table==="profiles")resolve({data:[{id:"user-1",full_name:"John",email:"john@vistora.com",property_id:"p1",rights:[]}],error:null});
     else resolve({data:[],error:null});
    }
   };
   return q;
  },
  rpc(fn){return Promise.resolve({data:true,error:null});}
 };
 db.sessionDb=()=>mockClient;
 try{
  // View user can GET role mappings
  const getRes=await db.workspaceContext.run({user:viewOnlyUser,client:mockClient},()=>roleRoute.GET(new NextRequest("http://localhost/api/role-mappings")));
  assert.equal(getRes.status,200);
  const getJson=await getRes.json();
  assert.equal(getJson.success,true);
  assert.equal(getJson.rules.length,1);

  // View user CANNOT mutate role mappings
  for(const method of ["POST","PATCH","DELETE"]){
   const denied=await db.workspaceContext.run({user:viewOnlyUser,client:mockClient},()=>roleRoute[method](new NextRequest("http://localhost/api/role-mappings",{method,headers: {"Content-Type":"application/json"}, body: JSON.stringify({id:"r1",role_name:"Test",module:"hospitality",department:"IT",assignee_id:"user-1"})})));
   assert.equal(denied.status,403);
   const deniedJson=await denied.json();
   assert.match(deniedJson.error,/Role mapping manage access required/i);
  }

  // Settings: view user CANNOT PATCH settings
  const settingsDenied=await db.workspaceContext.run({user:viewOnlyUser,client:mockClient},()=>settingsRoute.PATCH(new NextRequest("http://localhost/api/settings",{method:"PATCH",headers: {"Content-Type":"application/json"}, body: JSON.stringify({type:"application",appSettings:{projectName:"Hacked"}})})));
  assert.equal(settingsDenied.status,403);
 }finally{
  db.sessionDb=originalSession;
 }
});

test("Single-property users automatically default to their assigned property and sanitize filters", async () => {
  const { sanitizePropertyFilter, matchesPropertyFilter } = require("../lib/platform/propertyFilterStore.ts");
  const { hotelReadView } = require("../lib/hospitality/read-view.ts");
  const db = require("../lib/platform/db.ts");
  const { NextRequest } = require("next/server");

  // 1. Single property user MUST always be sanitized to their single property, never "all"
  assert.deepEqual(sanitizePropertyFilter(["all"], ["prop-single"]), ["prop-single"]);
  assert.deepEqual(sanitizePropertyFilter(["other-prop"], ["prop-single"]), ["prop-single"]);
  assert.deepEqual(sanitizePropertyFilter([], ["prop-single"]), ["prop-single"]);
  assert.deepEqual(sanitizePropertyFilter(["prop-single"], ["prop-single"]), ["prop-single"]);

  // 2. Multi-property staff can select "all" (assigned) or valid subsets, discarding invalid
  assert.deepEqual(sanitizePropertyFilter(["all"], ["p1", "p2"]), ["all"]);
  assert.deepEqual(sanitizePropertyFilter(["p1"], ["p1", "p2"]), ["p1"]);
  assert.deepEqual(sanitizePropertyFilter(["p1", "other"], ["p1", "p2"]), ["p1"]);
  assert.deepEqual(sanitizePropertyFilter(["other"], ["p1", "p2"]), ["all"]);

  // 3. Super admin retains unrestricted access
  assert.deepEqual(sanitizePropertyFilter(["all"], null), ["all"]);
  assert.deepEqual(sanitizePropertyFilter(["any-prop"], null), ["any-prop"]);

  // 4. matchesPropertyFilter handles single property and all
  assert.equal(matchesPropertyFilter("prop-single", ["prop-single"]), true);
  assert.equal(matchesPropertyFilter("other-prop", ["prop-single"]), false);
  assert.equal(matchesPropertyFilter("any", ["all"]), true);

  // 5. hotelReadView safely scopes single-property users without throwing 403 on "all" or stale property
  const singlePropUser = {
    id: "staff-1",
    fullName: "Hotel Staff",
    email: "staff@hotel.com",
    role: "receptionist",
    organizationId: "org-1",
    isOrganizationAdmin: false,
    propertyIds: ["prop-single"],
    rights: ["module:hospitality"],
    accessToken: "test-token",
  };

  const queries = [];
  const mockClient = {
    rpc(fn) {
      if (fn === "workspace_module") return Promise.resolve({ data: true, error: null });
      if (fn === "complaint_schema_ready") return Promise.resolve({ data: true, error: null });
      return Promise.resolve({ data: null, error: null });
    },
    from(table) {
      const q = {
        select(cols, opts) {
          if (opts?.count) q._isCount = true;
          return q;
        },
        eq(col, val) {
          queries.push({ table, op: "eq", col, val });
          return q;
        },
        in(col, vals) {
          queries.push({ table, op: "in", col, vals });
          return q;
        },
        not() { return q; },
        order() { return q; },
        limit() { return q; },
        single() { return Promise.resolve({ data: { id: "prop-single", name: "Prop Single" }, error: null }); },
        then(resolve) {
          if (q._isCount) resolve({ count: 5, error: null });
          else if (table === "properties") resolve({ data: [{ id: "prop-single", name: "Single Hotel", is_active: true }], error: null });
          else resolve({ data: [], error: null });
        },
      };
      return q;
    },
  };

  const orig = db.sessionDb;
  db.sessionDb = () => mockClient;
  try {
    // When requesting property="all", single-property user must automatically resolve to prop-single without 403
    queries.length = 0;
    const res = await db.workspaceContext.run({ user: singlePropUser, client: mockClient }, () =>
      hotelReadView(new NextRequest("http://localhost/api/hospitality?property=all"))
    );
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    // Verified queries scoped to prop-single
    assert.ok(queries.some(q => q.op === "eq" && q.col === "property_id" && q.val === "prop-single"));

    // When requesting stale unauthorized property, single-property user also resolves safely
    queries.length = 0;
    const resStale = await db.workspaceContext.run({ user: singlePropUser, client: mockClient }, () =>
      hotelReadView(new NextRequest("http://localhost/api/hospitality?property=stale-other-id"))
    );
    assert.equal(resStale.status, 200);
  } finally {
    db.sessionDb = orig;
  }
});

test("Self-modification is blocked, subordinate delegation enforced, and guest import rights strictly isolated", async () => {
  const db = require("../lib/platform/db.ts");
  const { NextRequest } = require("next/server");
  const usersRoute = require("../app/api/users/route.ts");
  const userDeleteRoute = require("../app/api/users/[id]/route.ts");
  const hospRoute = require("../app/api/hospitality/route.ts");
  const importRoute = require("../app/api/hospitality/import/route.ts");

  const orig = db.sessionDb;

  const staffUser = {
    id: "staff-caller",
    fullName: "Staff Caller",
    email: "staff@hotel.com",
    role: "staff",
    orgRole: "staff",
    organizationId: "org-1",
    isOrganizationAdmin: false,
    propertyIds: ["prop-1"],
    propertyId: "prop-1",
    rights: ["module:hospitality", "manage_users", "view_users", "manage_properties"], // Has hospitality module, but NOT import_guests or manage_settings!
    accessToken: "verified",
  };

  const targetSubordinate = {
    id: "sub-1",
    full_name: "Subordinate Staff",
    email: "sub@hotel.com",
    role: "staff",
    rights: ["view_users"],
    organization_id: "org-1",
    property_ids: ["prop-1"],
  };

  const targetHigher = {
    id: "higher-1",
    full_name: "Higher Admin",
    email: "higher@hotel.com",
    role: "admin",
    rights: ["manage_users", "manage_settings"], // Has manage_settings, which caller lacks
    organization_id: "org-1",
    property_ids: ["prop-1"],
  };

  const mockClient = {
    rpc(fn) {
      if (fn === "workspace_module") return Promise.resolve({ data: true, error: null });
      return Promise.resolve({ data: true, error: null });
    },
    from(table) {
      const q = {
        select() { return q; },
        eq(col, val) {
          q._eqCol = col;
          q._eqVal = val;
          return q;
        },
        single() {
          if (table === "profiles") {
            if (q._eqVal === "staff-caller") return Promise.resolve({ data: { id: "staff-caller", full_name: "Staff Caller", email: "staff@hotel.com", role: "staff", rights: staffUser.rights }, error: null });
            if (q._eqVal === "sub-1") return Promise.resolve({ data: targetSubordinate, error: null });
            if (q._eqVal === "higher-1") return Promise.resolve({ data: targetHigher, error: null });
          }
          if (table === "organization_members") {
            return Promise.resolve({ data: { user_id: q._eqVal, role: "member", organization_id: "org-1" }, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
        maybeSingle() { return q.single(); },
      };
      return q;
    },
  };

  db.sessionDb = () => mockClient;
  try {
    // 1. Self-editing rights prevention: staff caller CANNOT modify their own permissions or role
    const selfEditRes = await db.workspaceContext.run({ user: staffUser, client: mockClient }, () =>
      usersRoute.PATCH(new NextRequest("http://localhost/api/users", {
        method: "PATCH",
        headers: {"Content-Type":"application/json"}, body: JSON.stringify({ userId: "staff-caller", rights: ["manage_users", "manage_settings"] }),
      }))
    );
    assert.equal(selfEditRes.status, 403);
    const selfJson = await selfEditRes.json();
    assert.match(selfJson.error, /cannot modify your own permissions/i);

    // 2. Subordinate delegation: caller CANNOT grant rights that they do not possess (e.g. manage_settings)
    const grantForbiddenRes = await db.workspaceContext.run({ user: staffUser, client: mockClient }, () =>
      usersRoute.PATCH(new NextRequest("http://localhost/api/users", {
        method: "PATCH",
        headers: {"Content-Type":"application/json"}, body: JSON.stringify({ userId: "sub-1", rights: ["view_users", "manage_settings"] }),
      }))
    );
    assert.equal(grantForbiddenRes.status, 403);
    const grantForbiddenJson = await grantForbiddenRes.json();
    assert.match(grantForbiddenJson.error, /can only grant permissions that your own account possesses/i);

    // 3. Target hierarchy protection: caller CANNOT edit a user holding higher/unheld rights
    const editHigherRes = await db.workspaceContext.run({ user: staffUser, client: mockClient }, () =>
      usersRoute.PATCH(new NextRequest("http://localhost/api/users", {
        method: "PATCH",
        headers: {"Content-Type":"application/json"}, body: JSON.stringify({ userId: "higher-1", rights: ["view_users"] }),
      }))
    );
    assert.equal(editHigherRes.status, 403);
    const editHigherJson = await editHigherRes.json();
    assert.match(editHigherJson.error, /permissions beyond your own authority/i);

    // 4. Target hierarchy on delete: caller CANNOT delete a user with higher rights
    const deleteHigherRes = await db.workspaceContext.run({ user: staffUser, client: mockClient }, () =>
      userDeleteRoute.DELETE(new NextRequest("http://localhost/api/users/higher-1", { method: "DELETE" }), { params: Promise.resolve({ id: "higher-1" }) })
    );
    assert.equal(deleteHigherRes.status, 403);
    const deleteHigherJson = await deleteHigherRes.json();
    assert.match(deleteHigherJson.error, /permissions beyond your own authority/i);

    // 5. Hospitality Import & Guest Creation strictly requires import_guests; manage_properties alone does NOT grant it
    const importRes = await db.workspaceContext.run({ user: staffUser, client: mockClient }, () =>
      importRoute.POST(new NextRequest("http://localhost/api/hospitality/import", {
        method: "POST",
        headers: {"Content-Type":"application/json"}, body: JSON.stringify({ property_ids: ["prop-1"], records: [{ guest_name: "Test", room_number: "101" }] }),
      }))
    );
    assert.equal(importRes.status, 403);
    const importJson = await importRes.json();
    assert.match(importJson.error, /Permission required to import/i);

    const stayRes = await db.workspaceContext.run({ user: staffUser, client: mockClient }, () =>
      hospRoute.POST(new NextRequest("http://localhost/api/hospitality", {
        method: "POST",
        headers: {"Content-Type":"application/json"}, body: JSON.stringify({ action: "stay", room_id: "room-1", check_in_date: "2026-11-04", check_out_date: "2026-11-06" }),
      }))
    );
    assert.equal(stayRes.status, 403);
    const stayJson = await stayRes.json();
    assert.match(stayJson.error, /guest management access required/i);
  } finally {
    db.sessionDb = orig;
  }
});

test("Property mutations and settings saving are strictly restricted to super admins, and role mapping is property-scoped", async () => {
  const db = require("../lib/platform/db.ts");
  const { NextRequest } = require("next/server");
  const propRoute = require("../app/api/properties/route.ts");
  const settingsRoute = require("../app/api/settings/route.ts");
  const roleRoute = require("../app/api/role-mappings/route.ts");

  const orig = db.sessionDb;

  const hotelAdmin = {
    id: "hotel-admin-1",
    fullName: "Hotel Admin",
    email: "admin@hotel.com",
    role: "admin",
    orgRole: "admin",
    organizationId: "org-1",
    isOrganizationAdmin: false, // NOT super admin
    propertyIds: ["prop-1"],
    propertyId: "prop-1",
    rights: ["manage_properties", "view_properties", "manage_settings", "view_settings", "manage_role_mapping", "view_role_mapping"],
    accessToken: "verified",
  };

  const superAdmin = {
    id: "super-admin-1",
    fullName: "Super Admin",
    email: "super@vistora.com",
    role: "super_admin",
    orgRole: "super_admin",
    organizationId: "org-1",
    isOrganizationAdmin: true,
    propertyIds: ["prop-1", "prop-2"],
    rights: ["org_role:super_admin"],
    accessToken: "verified",
  };

  const mockClient = {
    from() {
      const q = {
        select() { return q; },
        insert() { return q; },
        update() { return q; },
        delete() { return q; },
        eq() { return q; },
        single: async () => ({ data: { id: "p1", name: "Test" }, error: null }),
        maybeSingle: async () => ({ data: null, error: null }),
      };
      return q;
    },
  };

  db.sessionDb = () => mockClient;

  try {
    // 1. Property POST/PATCH/DELETE restricted to super admins only
    const postPropRes = await db.workspaceContext.run({ user: hotelAdmin, client: mockClient }, () =>
      propRoute.POST(new NextRequest("http://localhost/api/properties", {
        method: "POST",
        headers: {"Content-Type":"application/json"}, body: JSON.stringify({ name: "New Hotel" }),
      }))
    );
    assert.equal(postPropRes.status, 403);
    const postPropJson = await postPropRes.json();
    assert.match(postPropJson.error, /Workspace administrator access required/i);

    const patchPropRes = await db.workspaceContext.run({ user: hotelAdmin, client: mockClient }, () =>
      propRoute.PATCH(new NextRequest("http://localhost/api/properties", {
        method: "PATCH",
        headers: {"Content-Type":"application/json"}, body: JSON.stringify({ propertyId: "prop-1", name: "Renamed Hotel" }),
      }))
    );
    assert.equal(patchPropRes.status, 403);

    const deletePropRes = await db.workspaceContext.run({ user: hotelAdmin, client: mockClient }, () =>
      propRoute.DELETE(new NextRequest("http://localhost/api/properties", {
        method: "DELETE",
        headers: {"Content-Type":"application/json"}, body: JSON.stringify({ propertyId: "prop-1" }),
      }))
    );
    assert.equal(deletePropRes.status, 403);

    // 2. Settings saving restricted to super admins only
    const saveSettingsRes = await db.workspaceContext.run({ user: hotelAdmin, client: mockClient }, () =>
      settingsRoute.PATCH(new NextRequest("http://localhost/api/settings", {
        method: "PATCH",
        headers: {"Content-Type":"application/json"}, body: JSON.stringify({ type: "application", appSettings: { projectName: "Test" } }),
      }))
    );
    assert.equal(saveSettingsRes.status, 403);
    const saveSettingsJson = await saveSettingsRes.json();
    assert.match(saveSettingsJson.error, /Only super administrators can save system settings/i);

    // 3. Role mapping: Hotel admin cannot create rule for property outside their assignment
    const roleOutsideRes = await db.workspaceContext.run({ user: hotelAdmin, client: mockClient }, () =>
      roleRoute.POST(new NextRequest("http://localhost/api/role-mappings", {
        method: "POST",
        headers: {"Content-Type":"application/json"}, body: JSON.stringify({
          module: "hospitality",
          property_id: "unauthorized-prop",
          department: "IT",
          role_name: "IT Lead",
          assignee_id: "user-1",
        }),
      }))
    );
    assert.equal(roleOutsideRes.status, 403);
    const roleOutsideJson = await roleOutsideRes.json();
    assert.match(roleOutsideJson.error, /assigned property/i);
  } finally {
    db.sessionDb = orig;
  }
});
