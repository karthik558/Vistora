export function emailContent(kind:string,payload:any) {
 const subjects:Record<string,string>={role_assignment:"A complaint needs your attention",sla:"Service case overdue",followup:"How was your concern resolved?",invitation:"Tell us about your stay",team_invitation:"Join your Vistora workspace",report:"Your guest experience report",operations_alert:"Hotel service job overdue"};
 let body=payload.link?"Open your secure link: "+payload.link:"";
 if(kind==="role_assignment")body="Work has been assigned to you at the "+(["Junior","Senior","GM"][payload.level]||"Junior")+" level.\nReference: "+payload.recordId+"\nChannel: "+payload.module+(payload.link?"\nOpen the workspace: "+payload.link:"");
 if(kind==="operations_alert")body="A hotel service job is overdue.\nJob: "+payload.jobId+"\nTitle: "+payload.title+"\nDeadline: "+payload.deadline;
 if(kind==="sla")body="A service case is overdue.\nCase: "+payload.feedbackId+"\nDepartment: "+payload.department+"\nDeadline: "+payload.deadline;
 if(kind==="report")body="Guest experience report\nPeriod: "+payload.summary.from+" to "+payload.summary.to+"\n\n"+Object.entries(payload.summary.current).map(([k,v])=>k+": "+(v??"No responses")).join("\n");
 if(kind==="guest_message")body=payload.body||"";
 return {subject:payload.subject||subjects[kind]||"Workspace notification",text:body};
}

export async function sendEmail(kind:string,payload:any,id:string) {
 const content=emailContent(kind,payload);
 const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:"Bearer "+process.env.RESEND_API_KEY,"Content-Type":"application/json","Idempotency-Key":id},body:JSON.stringify({from:process.env.MAIL_FROM,to:[payload.recipient],...content}),signal:AbortSignal.timeout(10000),redirect:"error"});
 return response.status;
}

export async function sendInvitationEmail(options: {
  recipient: string;
  guestName: string;
  roomNumber?: string;
  propertyName?: string;
  inviteLink: string;
}): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { success: false, error: "RESEND_API_KEY is not configured in environment." };
  }

  const configuredFrom = process.env.MAIL_FROM?.trim() || "onboarding@resend.dev";
  const brandName = options.propertyName || "Vistora Hospitality";
  const subject = options.propertyName 
    ? `Your stay at ${options.propertyName} · We value your feedback`
    : "Tell us about your stay · Guest Feedback";
  const guestSalutation = options.guestName?.trim() || "Valued Guest";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#0c1017;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f1f5f9;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#0c1017;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background-color:#121824;border:1px solid rgba(255,255,255,0.08);border-radius:12px;overflow:hidden;box-shadow:0 12px 36px rgba(0,0,0,0.45);">
          <tr>
            <td style="padding:36px 36px 20px 36px;border-bottom:1px solid rgba(255,255,255,0.06);">
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#c5a059;font-weight:700;">${brandName}</div>
              <h1 style="margin:16px 0 0 0;font-size:22px;font-weight:600;color:#ffffff;letter-spacing:-0.3px;">Dear ${guestSalutation},</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 36px 36px 36px;">
              <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#94a3b8;">
                Thank you for staying with us${options.roomNumber ? ` in <strong>${options.roomNumber}</strong>` : ""} at <strong>${brandName}</strong>. We hope every aspect of your visit was enjoyable.
              </p>
              <p style="margin:0 0 28px 0;font-size:15px;line-height:1.6;color:#94a3b8;">
                We are dedicated to providing the highest standard of hospitality. We would be grateful if you could take a moment to share your personal feedback with our leadership team.
              </p>
              <div style="text-align:center;margin:32px 0;">
                <a href="${options.inviteLink}" style="display:inline-block;background-color:#c5a059;color:#0c1017;text-decoration:none;font-size:14px;font-weight:600;padding:14px 32px;border-radius:6px;letter-spacing:0.3px;">
                  Share Your Feedback
                </a>
              </div>
              <p style="margin:28px 0 0 0;font-size:13px;line-height:1.5;color:#64748b;">
                This secure feedback link is unique to your stay. You can also open the form directly:<br>
                <a href="${options.inviteLink}" style="color:#c5a059;word-break:break-all;font-size:12px;">${options.inviteLink}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#0d121b;padding:18px 36px;border-top:1px solid rgba(255,255,255,0.06);font-size:11px;color:#475569;text-align:center;">
              Sent by ${brandName} · Powered by Vistora Hospitality
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `Dear ${guestSalutation},\n\nThank you for choosing ${brandName}${options.roomNumber ? ` (${options.roomNumber})` : ""}.\n\nWe would be honored if you could take a moment to share your feedback with our leadership team:\n${options.inviteLink}\n\nWarm regards,\n${brandName}`;

  async function executeSend(sender: string) {
    const fromHeader = sender.includes("<") ? sender : `Vistora <${sender}>`;
    return await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromHeader,
        to: [options.recipient],
        subject,
        html,
        text,
      }),
      signal: AbortSignal.timeout(10000),
    });
  }

  try {
    let res = await executeSend(configuredFrom);
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      // If unverified custom domain error, retry with onboarding@resend.dev
      if (errBody?.message?.includes("domain is not verified") && configuredFrom !== "onboarding@resend.dev") {
        const fallbackRes = await executeSend("onboarding@resend.dev");
        if (fallbackRes.ok) {
          return { success: true };
        }
        const fallbackErr = await fallbackRes.json().catch(() => ({}));
        return { success: false, error: fallbackErr?.message || errBody.message };
      }
      return { success: false, error: errBody?.message || `Resend delivery failed with status ${res.status}` };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to connect to email service" };
  }
}
