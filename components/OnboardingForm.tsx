"use client";
import {FormEvent,useState} from "react";
import Link from "next/link";
export default function OnboardingForm({invitation}:{invitation?:string}){
 const [stage,setStage]=useState("signin"),[error,setError]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setBusy(true);setError("");setMessage("");
  try{
   const b=Object.fromEntries(new FormData(e.currentTarget));
   const url=stage==="workspace"?"/api/onboarding":stage==="signup"?"/api/auth/signup":"/api/auth/login";
   const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...b,...(stage==="workspace"&&invitation?{invitation}:{})})}),j=await r.json();
   if(!r.ok)throw new Error(j.error);
   if(stage==="signup"){setMessage(j.message);setStage("signin");}
   else if(stage==="signin"&&!j.needsOnboarding&&!invitation)location.assign("/dashboard");
   else if(stage==="signin"){setStage("workspace");setMessage(invitation?"Accept your invitation to join the team.":"Name your new workspace.");}
   else location.assign("/dashboard");
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 return <main className="onboarding-shell"><section className="onboarding-card"><Link href="/"><img src="/logo1.webp" alt="Vistora" width={120}/></Link><h1>{invitation?"Join your team":"Set up your workspace"}</h1>{error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}<form onSubmit={submit}>
 {stage!=="workspace"?<>{stage==="signup"&&<label>Full name<input name="fullName" required maxLength={100} autoComplete="name"/></label>}<label>Work email<input name="email" type="email" autoComplete="email" required/></label><label>Password<input name="password" type="password" minLength={stage==="signup"?10:6} autoComplete={stage==="signup"?"new-password":"current-password"} required/></label></>:!invitation&&<><label>Company name<input name="name" required maxLength={100}/></label><label>Workspace address<input name="slug" required maxLength={60} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="your-company"/></label></>}
 <button className="button button-dark" disabled={busy}>{busy?"Working…":stage==="workspace"?invitation?"Accept invitation":"Create workspace":stage==="signup"?"Create account":"Sign in"}</button></form>
 {stage!=="workspace"&&<button className="button button-ghost" onClick={()=>{setStage(stage==="signup"?"signin":"signup");setError("");}}>{stage==="signup"?"Already have an account? Sign in":"Create an account"}</button>}</section></main>;
}
