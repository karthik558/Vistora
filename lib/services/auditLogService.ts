import { createHash, randomUUID } from "node:crypto";
import { checked, serviceDb, workspaceDb, workspaceContext, workspaceUser } from "../platform/db";
export type AuditCategory = "pii_access"|"export"|"sla_status"|"permission"|"security"|"system";
export interface AuditLogItem { id:string;timestamp:string;actorName:string;actorEmail:string;actorRole:string;action:string;category:AuditCategory;resource:string;details?:string;ip?:string;hash:string;status:"success"|"warning"|"alert";complianceTag?:string; }
export async function listAuditLogs(limit=100,category?:string):Promise<AuditLogItem[]> {
  let query=workspaceDb().from("audit_logs").select("*").order("created_at",{ascending:false}).limit(Math.min(500,Math.max(1,limit)));
  if(category&&category!=="all")query=query.eq("category",category);
  return checked(await query).map((r:any)=>({id:r.id,timestamp:r.created_at,actorName:r.actor_name,actorEmail:r.actor_email,actorRole:r.actor_role,action:r.action,category:r.category,resource:r.resource,details:r.details,ip:r.ip,hash:r.hash,status:r.status,complianceTag:r.compliance_tag}));
}
export async function logAuditEvent(entry:{actorName:string;actorEmail:string;actorRole:string;action:string;category?:AuditCategory;resource:string;details?:string;ip?:string;status?:"success"|"warning"|"alert";complianceTag?:string;organizationId?:string}) {
  const context=workspaceContext.getStore(),user=context?.user;
  if(!user&&!entry.organizationId)throw new Error("An organization is required for auditing.");
  const timestamp=new Date().toISOString(),id=randomUUID();
  const row={id,organization_id:user?.organizationId||entry.organizationId,actor_name:user?.fullName||entry.actorName,actor_email:user?.email||entry.actorEmail,actor_role:user?.role||entry.actorRole,action:entry.action.slice(0,200),category:entry.category||"system",resource:entry.resource.slice(0,300),details:entry.details?.slice(0,4000),ip:entry.ip||null,status:entry.status||"success",compliance_tag:entry.complianceTag||null,created_at:timestamp,hash:""};
  row.hash=createHash("sha256").update(JSON.stringify(row)).digest("hex");
  checked(await (context?workspaceDb():serviceDb()).from("audit_logs").insert(row).select().single());
  return {id,timestamp,actorName:row.actor_name,actorEmail:row.actor_email,actorRole:row.actor_role,action:row.action,category:row.category,resource:row.resource,hash:row.hash,status:row.status};
}
