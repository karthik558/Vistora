import {serviceDb,checked} from "../platform/db";

type Trigger="feedback_received"|"case_resolved";
const defaults:Record<Trigger,{enabled:boolean;subject:string;body:string}>={
 feedback_received:{enabled:true,subject:"Thank you for your feedback, {{guestName}}",body:"Hello {{guestName}},\n\nThank you for sharing your feedback with {{propertyName}}. We appreciate you helping us improve."},
 case_resolved:{enabled:true,subject:"An update from {{propertyName}}",body:"Hello {{guestName}},\n\nYour concern has been marked as resolved. We would value your feedback on how we handled it."}
};
export async function queueGuestMessage(input:{organizationId:string;propertyId:string;feedbackId:string;guestName:string;guestEmail?:string|null;propertyName:string;trigger:Trigger;rating?:number}) {
 if(!input.guestEmail)return;
 const db=serviceDb();
 const {data,error}=await db.from("organization_settings").select("settings").eq("organization_id",input.organizationId).maybeSingle();
 if(error)throw new Error(error.message);
 const config=data?.settings?.guestMessaging?.[input.trigger]||defaults[input.trigger];
 if(config.enabled===false)return;
 const tokens:Record<string,string>={guestName:input.guestName||"Guest",propertyName:input.propertyName,rating:String(input.rating??"")};
 const render=(value:string)=>value.replace(/\{\{(guestName|propertyName|rating)\}\}/g,(_m,key:string)=>tokens[key]||"").slice(0,4000);
 const idempotency=`guest-message:${input.trigger}:${input.feedbackId}`;
 checked(await db.from("notification_outbox").upsert({organization_id:input.organizationId,kind:"guest_message",dedup_key:idempotency,payload:{recipient:input.guestEmail,subject:render(config.subject||defaults[input.trigger].subject),body:render(config.body||defaults[input.trigger].body),propertyId:input.propertyId,feedbackId:input.feedbackId,channel:"email"},status:"queued"},{onConflict:"dedup_key",ignoreDuplicates:true}).select("id"));
}