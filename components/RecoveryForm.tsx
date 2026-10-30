"use client";
import {FormEvent,useEffect,useState} from "react";
export default function RecoveryForm({token}:{token:string}){
 const [data,setData]=useState<any>(null),[error,setError]=useState(""),[done,setDone]=useState(false),[busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true),[attempt,setAttempt]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();setLoading(true);setError("");setData(null);setDone(false);
  fetch("/api/recovery/"+encodeURIComponent(token),{signal:controller.signal}).then(async r=>{
   const j=await r.json();if(!r.ok||!j.success)throw new Error(j.error||"We couldn’t load your feedback form.");
   if(!controller.signal.aborted){setData(j.data);setDone(!!j.data.responded_at);}
  }).catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[token,attempt]);
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError("");const f=new FormData(e.currentTarget);try{const r=await fetch("/api/recovery/"+token,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({rating:Number(f.get("rating")),recommendationScore:f.get("nps")===""?null:Number(f.get("nps")),comment:f.get("comment")})}),j=await r.json();if(!r.ok)throw new Error(j.error);setDone(true);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <main className="onboarding-shell"><section className="onboarding-card" aria-busy={loading||busy}>
  {data?.organizations?.logo_url?<img src={data.organizations.logo_url} alt={data.organizations.name} style={{maxWidth:140,maxHeight:60,objectFit:"contain"}}/>:<strong>{data?.organizations?.name||"Vistora"}</strong>}
  <h1>{done?"Thank you":"How did we resolve your concern?"}</h1>
  {loading&&<p role="status">Loading your feedback form…</p>}
  {error&&<p role="alert">{error}</p>}
  {!loading&&!data&&error&&<button type="button" className="button button-outline" onClick={()=>setAttempt(value=>value+1)}>Try again</button>}
  {done?<p role="status">Your response has been recorded.</p>:data&&<form onSubmit={submit}>
   <label>Recovery satisfaction<select name="rating" required disabled={busy}><option value="">Choose a rating</option>{[1,2,3,4,5].map(n=><option key={n} value={n}>{n} / 5</option>)}</select></label>
   <label>How likely are you to recommend us?<select name="nps" disabled={busy}><option value="">Optional · 0 to 10</option>{Array.from({length:11},(_,n)=><option key={n}>{n}</option>)}</select></label>
   <label>Anything else? (optional)<textarea name="comment" maxLength={2000} rows={4} disabled={busy}/></label>
   <button className="button button-dark" disabled={busy}>{busy?"Submitting…":"Send response"}</button>
  </form>}
 </section></main>;
}
