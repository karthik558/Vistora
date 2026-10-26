const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),ts=require("typescript");
require.extensions[".ts"]=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021,esModuleInterop:true}}).outputText,file);
const {summarize,managementReport,csvCell}=require("../lib/platform/reports.ts");
const {newToken,hashToken,encryptSecret,decryptSecret}=require("../lib/platform/secrets.ts");
const {validateDestination}=require("../lib/platform/transport.ts");
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
