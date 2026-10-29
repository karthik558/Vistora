// Deploy with: supabase functions deploy omniops-scheduler --no-verify-jwt
// Schedule every minute via Supabase Cron / pg_net, keeping secrets in Vault.
// This adapter invokes the existing authenticated worker, including outbox delivery.
// @ts-nocheck -- Deno Edge runtime, checked separately from the Next.js compilation.
Deno.serve(async(request:Request)=>{
 if(request.method!=="POST")return new Response("Method not allowed",{status:405});
 const secret=Deno.env.get("WORKSPACE_CRON_SECRET"),appUrl=Deno.env.get("APP_URL");
 if(!secret||!appUrl)return new Response("Scheduler is not configured",{status:503});
 const actual=request.headers.get("authorization")||"";
 const expected="Bearer "+secret;
 const encoder=new TextEncoder();const a=await crypto.subtle.digest("SHA-256",encoder.encode(actual)),b=await crypto.subtle.digest("SHA-256",encoder.encode(expected));
 const aa=new Uint8Array(a),bb=new Uint8Array(b);let diff=0;for(let i=0;i<aa.length;i++)diff|=aa[i]^bb[i];if(diff)return new Response("Unauthorized",{status:401});
 const response=await fetch(appUrl.replace(/\/$/,"")+"/api/jobs",{method:"POST",headers:{authorization:expected},signal:AbortSignal.timeout(55000)});
 return new Response(await response.text(),{status:response.status,headers:{"Content-Type":"application/json"}});
});
