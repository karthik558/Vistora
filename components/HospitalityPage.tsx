"use client";
import {FormEvent,useEffect,useRef,useState} from "react";
import Link from "next/link";
import {useSearchParams} from "next/navigation";
import {AppShell,WorkspaceUser} from "./Dashboard";
import WorkspaceSelect from "./WorkspaceSelect";
import WorkspaceDateField from "./WorkspaceDateField";
import {useAppearance} from "./AppearanceProvider";
import {hospitalityConfig,money,ModuleName} from "../lib/hospitality/config";
import {BedDouble,Users,ClipboardList,ClipboardCheck,Wallet,RefreshCw,ArrowUpRight} from "lucide-react";

const format=(value:string)=>new Date(value).toLocaleString();
const label=(value:string)=>value.replaceAll("_"," ");
const tabs=["Overview","Guests","Rooms","Service jobs","Inspections","Cost controls"] as const;
type Tab=typeof tabs[number];
type Save=(body:any,method?:string)=>Promise<boolean>;
const stateOptions=(values:string[])=>values.map(value=>({value,label:label(value)}));

function GuestForm({guest,save,cancel}:{guest:any;save:Save;cancel:()=>void}){
 return <form key={guest?.id||"new"} className="platform-fields" onSubmit={async e=>{
  e.preventDefault();const form=e.currentTarget,fields=Object.fromEntries(new FormData(form));
  if(await save({action:"guest",...fields,...(guest?{id:guest.id}:{})},guest?"PATCH":"POST")){form.reset();cancel();}
 }}>
 <label>Guest name<input name="full_name" defaultValue={guest?.full_name||""} required maxLength={100}/></label>
 <label>Email<input name="email" type="email" defaultValue={guest?.email||""}/></label>
 <label>Phone<input name="phone" defaultValue={guest?.phone||""} maxLength={40}/></label>
 <label>Guest tier<WorkspaceSelect label="Guest tier" name="vip_tier" defaultValue={guest?.vip_tier||"Standard"} options={stateOptions(["Standard","Returning","VIP"])}/></label>
 <label className="hotel-wide-field">Stay preferences<input name="preferences" defaultValue={guest?.preferences||""} maxLength={2000} placeholder="Accessibility, room or service preferences"/></label>
 <button className="button button-dark">{guest?"Update guest":"Add guest"}</button>{guest&&<button type="button" className="button button-ghost" onClick={cancel}>Cancel editing</button>}
 </form>;
}
function JobForm({data,save}:{data:any;save:Save}){
 const [property,setProperty]=useState(""),[room,setRoom]=useState(""),[source,setSource]=useState(""),[title,setTitle]=useState("");
 const rooms=data.rooms.filter((r:any)=>r.property_id===property),team=data.team.filter((p:any)=>p.isAdmin||p.property_id===property||p.property_ids?.includes(property));
 return <form className="platform-fields" onSubmit={async e=>{
  e.preventDefault();if(!property){return;}
  const form=e.currentTarget,fields=Object.fromEntries(new FormData(form));
  const deadline=String(fields.due_at||"");
  if(await save({action:"job",...fields,property_id:property,room_id:room,feedback_id:source,title,due_at:deadline?new Date(deadline).toISOString():undefined})){
   form.reset();setTitle("");setRoom("");setSource("");
  }
 }}>
 <label>Property<WorkspaceSelect label="Job property" value={property} onChange={id=>{setProperty(id);setRoom("");setSource("");}} placeholder="Choose property" options={data.properties.filter((p:any)=>p.is_active).map((p:any)=>({value:p.id,label:p.name}))}/></label>
 <label>Room · optional<WorkspaceSelect label="Job room" value={room} onChange={setRoom} options={[{value:"",label:"No specific room"},...rooms.map((r:any)=>({value:r.id,label:r.room_number}))]}/></label>
 <label>Job type<WorkspaceSelect label="Job type" name="kind" defaultValue="guest_request" options={stateOptions(["guest_request","cleaning","maintenance","inspection"])}/></label>
 <label>Title<input value={title} onChange={e=>setTitle(e.target.value)} required maxLength={160}/></label>
 <label>Priority<WorkspaceSelect label="Job priority" name="priority" defaultValue="normal" options={stateOptions(["low","normal","high","critical"])}/></label>
 <label>Assign to<WorkspaceSelect key={property} label="Job assignee" name="assigned_to" options={[{value:"",label:"Unassigned"},...team.map((p:any)=>({value:p.id,label:p.full_name}))]}/></label>
 <label>Deadline · optional<WorkspaceDateField name="due_at" label="Job deadline" mode="datetime"/></label>
 <label>Link an open feedback case<WorkspaceSelect label="Feedback source" value={source} onChange={id=>{setSource(id);const item=data.feedback.find((f:any)=>f.id===id);if(item){setProperty(item.property_id);setRoom(data.rooms.find((r:any)=>r.property_id===item.property_id&&r.room_number===item.room_number)?.id||"");setTitle("Guest feedback · "+item.department);}}} options={[{value:"",label:"No feedback source"},...data.feedback.filter((f:any)=>!property||f.property_id===property).map((f:any)=>({value:f.id,label:f.department+" · Room "+f.room_number+" · "+f.rating+"/5"}))]}/></label>
 <label className="hotel-wide-field">Details<input name="description" maxLength={2000}/></label>
 <button className="button button-dark" disabled={!property}>Create service job</button>
 </form>;
}

export default function HospitalityPage({user}:{user:WorkspaceUser}){
 const appearance=useAppearance();
 const query=useSearchParams();
 const section=query.get("section");
 const [tab,setTabState]=useState<Tab>(tabs.includes(section as Tab)&&(user.isOrganizationAdmin||section!=="Cost controls")?section as Tab:"Overview");
 useEffect(()=>{setTabState(tabs.includes(section as Tab)&&(user.isOrganizationAdmin||section!=="Cost controls")?section as Tab:"Overview");},[section,user.isOrganizationAdmin]);
 function setTab(next:Tab){
  setTabState(next);
  const params=new URLSearchParams(query.toString());params.set("section",next);
  window.history.replaceState(null,"","/dashboard/hospitality?"+params);
 }
 const [data,setData]=useState<any>(null),[error,setError]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [property,setProperty]=useState(query.get("property")||"all"),[month,setMonth]=useState(new Date().toISOString().slice(0,7)),[search,setSearch]=useState(""),[guest,setGuest]=useState<any>(null);
 const [inspectionRoom,setInspectionRoom]=useState("");
 const [jobView,setJobView]=useState("active");
 const sequence=useRef(0);
 async function load(){
  const ticket=++sequence.current;setLoading(true);
  try{
   const response=await fetch("/api/hospitality?"+new URLSearchParams({property,month,search,jobs:jobView}),{cache:"no-store"}),json=await response.json();
   if(!response.ok)throw new Error(json.error||"Could not load hotel operations.");
   if(ticket===sequence.current){setData(json);setError("");}
  }catch(error){if(ticket===sequence.current)setError((error as Error).message);}
  finally{if(ticket===sequence.current)setLoading(false);}
 }
 useEffect(()=>{const timer=setTimeout(()=>load(),200);return()=>clearTimeout(timer);},[property,month,search,jobView]);
 async function save(body:any,method="POST"){
  setBusy(true);setError("");setMessage("");
  try{
   const response=await fetch("/api/hospitality",{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}),json=await response.json();
   if(!response.ok)throw new Error(json.error||"Could not save changes.");
   setMessage(body.action==="inspection"?json.result.passed?"Inspection passed. Room readiness updated.":"Inspection recorded. A maintenance follow-up was created.":"Saved successfully.");
   await load();return true;
  }catch(error){setError((error as Error).message);return false;}
  finally{setBusy(false);}
 }
 async function copyFeedbackLink(id:string){
  try{const response=await fetch("/api/hospitality?stayLink="+id,{cache:"no-store"}),json=await response.json();if(!response.ok)throw new Error(json.error);const link=location.origin+json.path;await navigator.clipboard.writeText(link);setMessage("Guest feedback link copied.");}catch(error){setError((error as Error).message);}
 }
 const config=hospitalityConfig(data?.config||appearance.config);
 const canManage=user.isOrganizationAdmin===true;
 const module:ModuleName=tab==="Guests"?"guests":tab==="Rooms"?"property":tab==="Inspections"?"compliance":"operations";
 const enabled=tab==="Overview"||config.modules[module as keyof typeof config.modules]!==false;
 const propertySelect=(name="property_id")=><WorkspaceSelect label="Property" name={name} defaultValue={property==="all"?"":property} placeholder="Choose property" options={(data?.properties||[]).filter((p:any)=>p.is_active).map((p:any)=>({value:p.id,label:p.name}))}/>;
 const roomOptions=(data?.rooms||[]).map((r:any)=>({value:r.id,label:r.room_number+" · "+(data.properties.find((p:any)=>p.id===r.property_id)?.name||"")+" · "+label(r.status)}));
 const nameOf=(id:string)=>data?.properties.find((p:any)=>p.id===id)?.name||"—";
 const roomOf=(id:string)=>data?.rooms.find((r:any)=>r.id===id)?.room_number||"—";
 const submit=(action:string)=>(e:FormEvent<HTMLFormElement>)=>{
  e.preventDefault();const form=e.currentTarget,fields=Object.fromEntries(new FormData(form));
  save({action,...fields}).then(ok=>{if(ok)form.reset();});
 };
 const cards=[
  {title:"Guest profiles · company",value:data?.metrics.guests,icon:Users,section:"Guests",color:"guests"},
  {title:"Guests in house · stays",value:data?.metrics.inHouse,icon:BedDouble,section:"Guests",color:"guests"},
  {title:"Rooms needing service",value:data?.metrics.roomsNeedService,icon:BedDouble,section:"Rooms",color:"property"},
  {title:"Open service jobs",value:data?.metrics.openJobs,icon:ClipboardList,section:"Service jobs",color:"operations"},
  {title:"Pending cost decisions",value:data?.metrics.pendingCosts,icon:Wallet,section:"Cost controls",color:"operations"}
 ];
 return <AppShell active={tab} user={user} module={module}><div className="platform-page hotel-page">
 <header className="platform-heading"><div><p className="eyebrow">Hotel operations · {canManage?"Admin":"Read only"}</p><h1>{tab==="Overview"?"Hospitality operations":tab}</h1></div><div className="platform-actions">{canManage&&<Link className="button button-ghost" href="/dashboard/settings?workspace=operations">Configure modules</Link>}<button className="button button-ghost" disabled={loading} onClick={load}><RefreshCw size={14}/>Refresh</button></div></header>
 <nav className="platform-tabs" aria-label="Hotel modules">{tabs.filter(t=>canManage||t!=="Cost controls").map(t=><button key={t} aria-current={t===tab?"page":undefined} onClick={()=>setTab(t)}>{t}</button>)}</nav>
 {!canManage&&<p className="platform-notice">Read-only access to your assigned properties. Operational changes and financial records are administrator-only.</p>}
 {error&&<p role="alert" className="platform-notice">{error}</p>}{message&&<p role="status" className="hotel-success">{message}</p>}
 {loading&&!data&&<p role="status">Loading hotel operations…</p>}
 {data&&<><div className="hotel-filter"><label>Property<WorkspaceSelect label="Filter hotel property" value={property} onChange={setProperty} options={[{value:"all",label:"All properties"},...data.properties.map((p:any)=>({value:p.id,label:p.name}))]}/></label>{tab==="Guests"&&<label>Find a guest<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search guest name"/></label>}{tab==="Cost controls"&&<label>Ledger month<WorkspaceDateField label="Ledger month" mode="month" value={month} onChange={value=>{if(value)setMonth(value);}} required/></label>}</div>
 {!enabled?<section className="platform-card"><h2>Module disabled</h2><p>Existing records are retained. Enable this module in Settings to continue.</p>{canManage&&<Link className="button button-dark" href="/dashboard/settings?workspace=operations">Open Settings</Link>}</section>:<>
 {tab==="Service jobs"&&<div className="hotel-filter"><label>Service board view<WorkspaceSelect label="Service board view" value={jobView} onChange={setJobView} options={[{value:"active",label:"Open and in progress"},{value:"closed",label:"Completed and cancelled"}]}/></label></div>}
 {tab==="Overview"&&<><section className="hotel-overview">{cards.filter(c=>canManage||c.value!==null).map(c=><button key={c.title} onClick={()=>setTab(c.section as Tab)} className="hotel-overview-card"><c.icon size={17}/><span>{c.title}</span><strong>{c.value}</strong><ArrowUpRight size={14}/></button>)}</section><section className="platform-card"><h2>Connected operations</h2><div className="hotel-workflow"><span>Reserve a room</span><span>Check in</span><span>Dispatch service</span><span>Inspect readiness</span><span>Review costs</span></div><p>Room readiness, guest stays, service work and cost decisions are recorded in the same company workspace.</p></section><section className="platform-card"><h2>Recent activity</h2>{!data.activity.length&&<p>{canManage?"No operational changes recorded yet.":"Activity history is available to administrators."}</p>}{data.activity.map((a:any)=><div className="platform-row" key={a.id}><span>{label(a.entity_type)} · {a.action}<small>{a.entity_id.slice(0,8)} · {a.actor_id?data.team.find((p:any)=>p.id===a.actor_id)?.full_name||"Former administrator":"System"}</small></span><time>{format(a.created_at)}</time></div>)}</section></>}
 {tab==="Guests"&&<>{canManage&&<section className="platform-card"><h2>{guest?"Edit guest":"Guest profile"}</h2><fieldset className="hotel-form-lock" disabled={busy}><GuestForm guest={guest} save={save} cancel={()=>setGuest(null)}/></fieldset></section>}<section className="platform-card"><h2>Guest directory</h2><p>{canManage?"Latest 100 matching profiles. Search looks across the company directory.":"Guest details require guest PII permission and are limited to stays in this property view."}</p><div className="platform-table"><table><thead><tr><th>Guest</th><th>Contact</th><th>Tier</th><th>Preferences</th><th>Action</th></tr></thead><tbody>{data.guests.map((g:any)=><tr key={g.id}><td>{g.full_name}</td><td>{g.email||"—"}<small>{g.phone||""}</small></td><td>{g.vip_tier}</td><td className="hotel-wrap">{g.preferences||"—"}</td><td>{canManage&&<button className="button button-ghost" onClick={()=>setGuest(g)}>Edit guest</button>}</td></tr>)}</tbody></table>{!data.guests.length&&<p>No matching guest profiles.</p>}</div></section>
 {canManage&&<section className="platform-card"><h2>Reserve a stay</h2><form className="platform-fields" onSubmit={submit("stay")}><label>Guest<WorkspaceSelect label="Reservation guest" name="guest_id" placeholder="Choose guest" options={data.guests.map((g:any)=>({value:g.id,label:g.full_name}))}/></label><label>Room<WorkspaceSelect label="Reservation room" name="room_id" placeholder="Choose room" options={roomOptions}/></label><label>Number of guests<input name="guest_count" type="number" min={1} max={20} defaultValue={1} required/></label><label>Arrival<WorkspaceDateField name="check_in_date" label="Arrival" required/></label><label>Departure<WorkspaceDateField name="check_out_date" label="Departure" required/></label><button className="button button-dark" disabled={busy}>Reserve stay</button></form></section>}
 <section className="platform-card"><h2>Reservations &amp; stays</h2><p>Latest 100 stays in this property view. Check-in requires room readiness and valid arrival dates.</p><div className="platform-table"><table><thead><tr><th>Guest</th><th>Property / room</th><th>Dates</th><th>State</th><th>Actions</th></tr></thead><tbody>{data.stays.map((s:any)=><tr key={s.id}><td>{s.guests?.full_name||"Guest"}</td><td>{nameOf(s.property_id)}<small>Room {s.room_number}</small></td><td>{s.check_in_date} → {s.check_out_date}</td><td>{label(s.status)}{s.feedback?.length>0&&<small>{s.feedback.map((f:any)=>f.rating+"/5 · "+label(f.status)).join(", ")}</small>}</td><td>{canManage&&<div className="platform-actions">{s.status==="reserved"&&<><button className="button button-dark" disabled={busy} onClick={()=>save({action:"stay",id:s.id,status:"active"},"PATCH")}>Check in</button><button className="button button-ghost" disabled={busy} onClick={()=>save({action:"stay",id:s.id,status:"cancelled"},"PATCH")}>Cancel stay</button></>}{s.status==="active"&&<><button className="button button-ghost" disabled={busy} onClick={()=>save({action:"stay",id:s.id,status:"checked_out"},"PATCH")}>Check out</button><button className="button button-ghost" onClick={()=>copyFeedbackLink(s.id)}>Copy feedback link</button></>}</div>}</td></tr>)}</tbody></table></div></section></>}
 {tab==="Rooms"&&<>{canManage&&<section className="platform-card"><h2>Add a room</h2><form className="platform-fields" onSubmit={submit("room")}><label>Property{propertySelect()}</label><label>Room number<input name="room_number" maxLength={30} required/></label><label>Room type<input name="room_type" defaultValue="Standard" maxLength={60} required/></label><label>Floor<input name="floor" maxLength={30}/></label><label>Capacity<input name="capacity" type="number" min={1} max={20} defaultValue={2} required/></label><label>Initial state<WorkspaceSelect label="Initial room state" name="status" defaultValue="dirty" options={stateOptions(["dirty","clean","out_of_service"])}/></label><button className="button button-dark" disabled={busy}>Add room</button></form></section>}
 <section className="platform-card"><h2>Room readiness</h2><p>Up to 200 rooms. A passing inspection marks a room inspected; checkout marks it dirty.</p><div className="platform-table"><table><thead><tr><th>Room</th><th>Property</th><th>Type / capacity</th><th>Readiness</th><th>Current stay</th><th>Update state</th></tr></thead><tbody>{data.rooms.map((r:any)=><tr key={r.id}><td>{r.room_number}<small>Floor {r.floor||"—"}</small></td><td>{nameOf(r.property_id)}</td><td>{r.room_type} · {r.capacity}</td><td><span className={"hotel-status "+r.status}>{label(r.status)}</span></td><td>{data.stays.find((s:any)=>s.room_id===r.id&&s.status==="active")?.guests?.full_name||"No active stay in this view"}</td><td><WorkspaceSelect label={"Update room "+r.room_number} disabled={busy||!canManage} value={r.status} options={stateOptions([...r.status==="inspected"?["inspected"]:[],"dirty","clean","out_of_service"])} onChange={status=>{if(status!==r.status)save({action:"room",id:r.id,status,notes:r.notes},"PATCH");}}/></td></tr>)}</tbody></table></div></section></>}
 {tab==="Service jobs"&&<>{canManage&&<section className="platform-card"><h2>Dispatch a job</h2><p>New jobs use your configured response target when no deadline is specified.</p><fieldset className="hotel-form-lock" disabled={busy}><JobForm data={data} save={save}/></fieldset></section>}<section className="platform-card"><h2>Service board</h2><p>{jobView==="active"?"Earliest 100 active jobs by deadline.":"Latest 100 closed jobs by deadline."} Closed jobs retain their history.</p><div className="platform-table"><table><thead><tr><th>Job</th><th>Property / room</th><th>Owner</th><th>Deadline</th><th>State</th><th>Actions</th></tr></thead><tbody>{data.jobs.map((j:any)=><tr key={j.id}><td>{j.title}<small>{label(j.kind)} · {j.priority}</small></td><td>{nameOf(j.property_id)}<small>Room {roomOf(j.room_id)}</small></td><td>{canManage&&["open","in_progress"].includes(j.status)?<WorkspaceSelect label={"Assign "+j.title} disabled={busy} value={j.assigned_to||""} placeholder={j.assignee?.full_name||"Unassigned"} options={[{value:"",label:"Unassigned"},...data.team.filter((p:any)=>p.isAdmin||p.property_id===j.property_id||p.property_ids?.includes(j.property_id)).map((p:any)=>({value:p.id,label:p.full_name}))]} onChange={assigned_to=>save({action:"job",id:j.id,assigned_to},"PATCH")}/>:j.assignee?.full_name||"Unassigned"}</td><td>{format(j.due_at)}<small>{j.escalated_at?"Escalation queued":Date.parse(j.due_at)<Date.now()&&["open","in_progress"].includes(j.status)?"Overdue":""}</small></td><td>{label(j.status)}</td><td>{canManage&&["open","in_progress"].includes(j.status)&&<div className="platform-actions">{j.status==="open"&&<button className="button button-ghost" disabled={busy} onClick={()=>save({action:"job",id:j.id,status:"in_progress"},"PATCH")}>Start</button>}<button className="button button-dark" disabled={busy} onClick={()=>save({action:"job",id:j.id,status:"completed"},"PATCH")}>Complete</button><button className="button button-ghost" disabled={busy} onClick={()=>save({action:"job",id:j.id,status:"cancelled"},"PATCH")}>Cancel job</button></div>}</td></tr>)}</tbody></table></div></section></>}
 {tab==="Inspections"&&<>{canManage&&<section className="platform-card"><h2>Room inspection</h2><p>Mark only checks that passed. Any failed check creates a maintenance follow-up.</p><form onSubmit={async e=>{e.preventDefault();const form=e.currentTarget,fields=new FormData(form);if(await save({action:"inspection",room_id:inspectionRoom,notes:fields.get("notes"),answers:config.inspectionChecklist.map((check,i)=>({label:check,passed:fields.get("check-"+i)==="on"}))})){form.reset();setInspectionRoom("");}}}><label className="hotel-inspection-room">Room<WorkspaceSelect label="Inspection room" value={inspectionRoom} onChange={setInspectionRoom} placeholder="Choose room" options={roomOptions}/></label><div className="hotel-inspection-checks" key={inspectionRoom}>{config.inspectionChecklist.map((check,i)=><label key={check} className="hotel-check-label"><input name={"check-"+i} type="checkbox"/>{check}</label>)}</div><label>Inspection notes<textarea key={inspectionRoom} name="notes" rows={3} maxLength={2000}/></label><button className="button button-dark" disabled={busy||!inspectionRoom}>Record inspection</button></form></section>}<section className="platform-card"><h2>Inspection records</h2><p>Latest 100 inspections. These records cannot be edited after submission.</p>{data.inspections.map((i:any)=><details key={i.id}><summary>Room {roomOf(i.room_id)} · {i.passed?"Passed":"Follow-up required"} · {format(i.created_at)}</summary><ul>{i.answers.map((a:any)=><li key={a.label}>{a.passed?"Passed":"Failed"} · {a.label}</li>)}</ul>{i.notes&&<p>{i.notes}</p>}</details>)}</section></>}
 {tab==="Cost controls"&&canManage&&<><section className="platform-card"><h2>Companywide monthly budget</h2><p>{month} · All properties · Pending decisions reserve budget immediately.</p><div className="platform-stats">{[["Hard limit",data.budget.limit],["Approved",data.budget.approved],["Pending",data.budget.pending],["Remaining",data.budget.remaining]].map(([title,amount])=><article key={String(title)} className="platform-stat"><span>{title}</span><strong className="hotel-money">{money(Number(amount),data.budget.currency)}</strong></article>)}</div>{data.budget.limit===0&&<p className="platform-notice">Costs are blocked until an administrator sets positive monthly and per-expense limits in Settings.</p>}</section>
 <section className="platform-card"><h2>Record an operating cost</h2><p>Records current-month spending only. Select the current month to add an expense. Amounts above the auto-approval threshold need an explicit decision.</p><form className="platform-fields" onSubmit={submit("cost")}><label>Property{propertySelect()}</label><label>Category<WorkspaceSelect name="category" label="Cost category" defaultValue="supplies" options={stateOptions(["supplies","maintenance","guest_recovery","other"])}/></label><label>Amount · {config.currency}<input name="amount" inputMode="decimal" pattern="[0-9]+([.][0-9]{1,2})?" required/></label><label className="hotel-wide-field">Description<input name="description" maxLength={300} required/></label><button className="button button-dark" disabled={busy||!config.monthlyBudgetMinor||!config.perExpenseLimitMinor||month!==new Date().toISOString().slice(0,7)}>Record cost</button></form></section>
 <section className="platform-card"><h2>Cost approvals &amp; ledger</h2><p>Latest 100 entries for the selected property and month. Final decisions are retained.</p><div className="platform-table"><table><thead><tr><th>Description</th><th>Property</th><th>Amount</th><th>Date</th><th>State</th><th>Decision</th></tr></thead><tbody>{data.costs.map((c:any)=><tr key={c.id}><td>{c.description}<small>{label(c.category)}</small></td><td>{nameOf(c.property_id)}</td><td>{money(Number(c.amount_minor),c.currency)}</td><td>{c.expense_date}</td><td>{c.status}</td><td>{c.status==="pending"&&<div className="platform-actions"><button className="button button-dark" disabled={busy} onClick={()=>save({action:"cost",id:c.id,status:"approved"},"PATCH")}>Approve</button><button className="button button-ghost" disabled={busy} onClick={()=>save({action:"cost",id:c.id,status:"rejected"},"PATCH")}>Reject</button></div>}</td></tr>)}</tbody></table></div></section></>}
 </>}
 </>}
 </div></AppShell>;
}
