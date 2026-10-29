// Configuration checks only. Never return credentials or contact providers here.
export function integrationStatus(env:Record<string,string|undefined>) {
 const present=(key:string)=>!!env[key]?.trim();
 const publicUrl=(value:string|undefined)=>{try{const u=new URL(value||"");return u.protocol==="https:"&&!u.username&&!u.password&&!u.hash&&(!u.port||u.port==="443");}catch{return false;}};
 const make=(name:string,requirements:Record<string,boolean>)=>({name,configured:Object.values(requirements).every(Boolean),missing:Object.keys(requirements).filter(key=>!requirements[key])});
 return [
  make("Application links",{APP_URL:publicUrl(env.APP_URL)}),
  make("Invitation and webhook encryption",{WORKSPACE_ENCRYPTION_KEY:/^[a-f\d]{64}$/i.test(env.WORKSPACE_ENCRYPTION_KEY||"")}),
  make("Email · Resend",{RESEND_API_KEY:present("RESEND_API_KEY"),MAIL_FROM:present("MAIL_FROM")}),
  make("Delivery webhook adapter",{DELIVERY_WEBHOOK_URL:publicUrl(env.DELIVERY_WEBHOOK_URL),DELIVERY_WEBHOOK_SECRET:present("DELIVERY_WEBHOOK_SECRET")}),
  make("Scheduled worker authentication",{WORKSPACE_CRON_SECRET:present("WORKSPACE_CRON_SECRET")}),
 ];
}
