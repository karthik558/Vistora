import {checked,serviceDb} from "./db";
import {decryptSecret,hashToken} from "./secrets";
import {sendSigned} from "./transport";
import {managementReport,reportRows} from "./reports";
import {sendEmail} from "./email";
export async function runWorker(org?:string) {
 const db=serviceDb();
 checked({data:true,error:(await db.rpc("schedule_workspace_work",{p_org:org||null})).error});
 const jobs=checked(await db.rpc("claim_workspace_jobs",{p_org:org||null,p_limit:5})),results=[];
 for(const job of jobs) {
  let status="retry",detail="";
  if(job.kind==="asset_cleanup") {
   try {
    if(!job.payload.objectPath?.startsWith(job.organization_id+"/"))throw new Error("Invalid attachment path.");
    checked(await db.storage.from("case-attachments").remove([job.payload.objectPath]));
    status="delivered";detail="Private attachment removed.";
   }catch(error){detail=error instanceof Error?error.message:"Attachment cleanup failed.";}
   checked(await db.rpc("finish_workspace_job",{p_id:job.id,p_lease:job.lease_token,p_status:status,p_detail:detail}));
   results.push({id:job.id,status,detail});continue;
  }
  try {
   const payload={...job.payload};
   if(job.kind==="sla") {
    const record=await db.from("feedback").select("status").eq("id",payload.feedbackId).eq("organization_id",job.organization_id).maybeSingle();
    if(record.error)throw new Error(record.error.message);
    if(!record.data||record.data.status==="resolved"){status="failed";throw new Error("Case is resolved or was removed; escalation cancelled.");}
   }
   if(job.kind==="followup"||job.kind==="invitation") {
    const table=job.kind==="followup"?"recovery_followups":"guest_invitations";
    const record=await db.from(table).select(job.kind==="followup"?"expires_at,responded_at":"expires_at,status").eq("token_hash",hashToken(payload.token)).eq("organization_id",job.organization_id).maybeSingle();
    if(record.error)throw new Error(record.error.message);
    const pending:any=record.data;
    if(!pending||Date.parse(pending.expires_at)<=Date.now()||pending.responded_at||(pending.status&&pending.status!=="pending")){status="failed";throw new Error("Invitation or follow-up is no longer pending; delivery cancelled.");}
   }
   let url=process.env.DELIVERY_WEBHOOK_URL,secret=process.env.DELIVERY_WEBHOOK_SECRET;
   if(job.kind==="webhook") {
    const endpoint=checked(await db.from("webhook_endpoints").select("*").eq("id",payload.endpointId).eq("organization_id",job.organization_id).single());
    if(!endpoint.is_active){status="failed";throw new Error("Webhook endpoint is disabled.");}
    url=endpoint.url;secret=decryptSecret(endpoint.secret_encrypted);
   } else {
    const base=process.env.APP_URL;
    if(["followup","invitation","team_invitation"].includes(job.kind)) {
     if(!base){status="blocked";throw new Error("APP_URL is not configured.");}
     const path=job.kind==="followup"?"/recovery/":job.kind==="team_invitation"?"/join/":"/feedback?token=";
     payload.link=base.replace(/\/$/,"")+path+payload.token+(job.kind==="invitation"?"&property="+payload.propertyId:"");
     delete payload.token;
    }
    if(job.kind==="report") {
     const run=checked(await db.from("report_runs").select("*").eq("id",payload.runId).eq("organization_id",job.organization_id).single());
     const summary=run.summary||managementReport(await reportRows(db,job.organization_id,payload.periodDays,payload.propertyId,new Date(payload.scheduledFor)),payload.periodDays,new Date(payload.scheduledFor));
     checked(await db.from("report_runs").update({summary,status:"generated"}).eq("id",run.id).select("id").single());
     payload.summary=summary;
    }
    if(!payload.recipient){status="blocked";throw new Error("No delivery recipient configured.");}
   }
   const directEmail=job.kind!=="webhook"&&(!payload.channel||payload.channel==="email")&&process.env.RESEND_API_KEY&&process.env.MAIL_FROM;
   if(!directEmail&&(!url||!secret)){status="blocked";throw new Error("Configure RESEND_API_KEY and MAIL_FROM for email, or DELIVERY_WEBHOOK_URL and DELIVERY_WEBHOOK_SECRET for a channel adapter.");}
   const code=directEmail?await sendEmail(job.kind,payload,job.id):await sendSigned(url!,{id:job.id,type:job.kind,organizationId:job.organization_id,createdAt:job.created_at,data:payload},secret!,job.id);
   if(code>=200&&code<300){status="delivered";detail="Endpoint acknowledged delivery ("+code+").";}
   else {status=code===429||code>=500?"retry":"failed";detail="Endpoint returned HTTP "+code+".";}
  } catch(error){detail=error instanceof Error?error.message:"Delivery failed.";}
  const finished=checked(await db.rpc("finish_workspace_job",{p_id:job.id,p_lease:job.lease_token,p_status:status,p_detail:detail}));
  if(finished) {
   const state=checked(await db.from("notification_outbox").select("status").eq("id",job.id).single());status=state.status;
   if(job.kind==="report")checked(await db.from("report_runs").update({status}).eq("id",job.payload.runId).eq("organization_id",job.organization_id).select("id").single());
  } else {status="superseded";detail="A newer worker owns this delivery.";}
  results.push({id:job.id,status,detail});
 }
 return results;
}
