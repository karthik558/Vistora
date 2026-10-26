export type ReportRow = {property_id:string;department:string;rating:number;recommendation_score:number|null;status:string;assigned_to:string|null;category:string;created_at:string;first_response_at:string|null;resolved_at:string|null;sla_deadline:string|null};
export function csvCell(value:unknown) {
 let cell=String(value??"");
 if(typeof value==="string"&&/^[=+@\-\t\r]/.test(cell))cell="'"+cell;
 return '"'+cell.replaceAll('"','""')+'"';
}
export function summarize(rows:ReportRow[]) {
 const nps=rows.filter(r=>r.recommendation_score!==null), answered=nps.length;
 const promoters=nps.filter(r=>r.recommendation_score!>=9).length, detractors=nps.filter(r=>r.recommendation_score!<=6).length;
 const times=rows.filter(r=>r.first_response_at).map(r=>(Date.parse(r.first_response_at!)-Date.parse(r.created_at))/60000);
 const resolutions=rows.filter(r=>r.resolved_at).map(r=>(Date.parse(r.resolved_at!)-Date.parse(r.created_at))/60000);
 return {responses:rows.length,averageRating:rows.length?Number((rows.reduce((n,r)=>n+r.rating,0)/rows.length).toFixed(2)):null,nps:answered?Math.round(100*(promoters-detractors)/answered):null,npsResponses:answered,promoters,detractors,open:rows.filter(r=>r.status!=="resolved").length,unassigned:rows.filter(r=>!r.assigned_to&&r.status!=="resolved").length,overdue:rows.filter(r=>r.status!=="resolved"&&r.sla_deadline&&Date.parse(r.sla_deadline)<Date.now()).length,meanResponseMinutes:times.length?Math.round(times.reduce((a,b)=>a+b,0)/times.length):null,meanResolutionMinutes:resolutions.length?Math.round(resolutions.reduce((a,b)=>a+b,0)/resolutions.length):null};
}
export function managementReport(rows:ReportRow[],days:number,end=new Date()) {
 const boundary=end.getTime()-days*86400000, previous=boundary-days*86400000;
 const current=rows.filter(r=>Date.parse(r.created_at)>=boundary&&Date.parse(r.created_at)<=end.getTime());
 const before=rows.filter(r=>Date.parse(r.created_at)>=previous&&Date.parse(r.created_at)<boundary);
 const group=(key:"property_id"|"assigned_to"|"category")=>Array.from(new Set(current.map(r=>r[key]||"Unassigned"))).map(name=>({name,...summarize(current.filter(r=>(r[key]||"Unassigned")===name))}));
 return {from:new Date(boundary).toISOString(),to:end.toISOString(),current:summarize(current),previous:summarize(before),properties:group("property_id"),workload:group("assigned_to"),categories:group("category")};
}
export const reportColumns="property_id,department,rating,recommendation_score,status,assigned_to,category,created_at,first_response_at,resolved_at,sla_deadline";
export async function reportRows(db:any,org:string,days:number,property?:string|null,end=new Date()):Promise<ReportRow[]> {
 const result:ReportRow[]=[];
 for(let offset=0;;offset+=1000) {
  let q=db.from("feedback").select(reportColumns).eq("organization_id",org).gte("created_at",new Date(end.getTime()-days*2*86400000).toISOString()).lte("created_at",end.toISOString()).order("created_at").order("id").range(offset,offset+999);
  if(property&&property!=="all")q=q.eq("property_id",property);
  const {data,error}=await q;if(error)throw new Error(error.message);
  result.push(...data);if(data.length<1000)break;
 }
 return result;
}
