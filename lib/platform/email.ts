export function emailContent(kind:string,payload:any) {
 const subjects:Record<string,string>={sla:"Service case overdue",followup:"How was your concern resolved?",invitation:"Tell us about your stay",team_invitation:"Join your Vistora workspace",report:"Your guest experience report",operations_alert:"Hotel service job overdue"};
 let body=payload.link?"Open your secure link: "+payload.link:"";
 if(kind==="operations_alert")body="A hotel service job is overdue.\nJob: "+payload.jobId+"\nTitle: "+payload.title+"\nDeadline: "+payload.deadline;
 if(kind==="sla")body="A service case is overdue.\nCase: "+payload.feedbackId+"\nDepartment: "+payload.department+"\nDeadline: "+payload.deadline;
 if(kind==="report")body="Guest experience report\nPeriod: "+payload.summary.from+" to "+payload.summary.to+"\n\n"+Object.entries(payload.summary.current).map(([k,v])=>k+": "+(v??"No responses")).join("\n");
 return {subject:subjects[kind]||"Workspace notification",text:body};
}
export async function sendEmail(kind:string,payload:any,id:string) {
 const content=emailContent(kind,payload);
 const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:"Bearer "+process.env.RESEND_API_KEY,"Content-Type":"application/json","Idempotency-Key":id},body:JSON.stringify({from:process.env.MAIL_FROM,to:[payload.recipient],...content}),signal:AbortSignal.timeout(10000),redirect:"error"});
 return response.status;
}
