"use client";
import {FormEvent,useEffect,useRef,useState} from "react";
import Link from "next/link";
import {useSearchParams} from "next/navigation";
import QRCode from "qrcode";
import RoomManagerModal from "./RoomManagerModal";
import {AppShell,WorkspaceUser} from "./Dashboard";
import WorkspaceSelect from "./WorkspaceSelect";
import WorkspaceDateField from "./WorkspaceDateField";
import DashboardPageHeading from "./DashboardPageHeading";
import PropertyFilter from "./PropertyFilter";
import ComplaintBoard from "./ComplaintBoard";
import {canManageServiceJobs} from "../lib/operations/access";
import {useAppearance} from "./AppearanceProvider";
import {hospitalityConfig,money,ModuleName} from "../lib/hospitality/config";
import {
 BedDouble,Users,ClipboardList,ClipboardCheck,RefreshCw,
 Plus,QrCode,ExternalLink,LogOut,X,Check,Search,Calendar,UserPlus,Building2,Sparkles,Upload,Layers,
} from "lucide-react";

const format=(value:string)=>new Date(value).toLocaleString();
const label=(value:string)=>value.replaceAll("_"," ");
const tabs=["Overview","Guests","Rooms","Complaints","Service jobs","Inspections","Cost controls"] as const;
type Tab=typeof tabs[number];
type Save=(body:any,method?:string)=>Promise<boolean>;
const stateOptions=(values:string[])=>values.map(value=>({value,label:label(value)}));

function Modal({
 open,
 title,
 subtitle,
 onClose,
 children,
 maxWidth=640
}:{
 open:boolean;
 title:string;
 subtitle?:string;
 onClose:()=>void;
 children:React.ReactNode;
 maxWidth?:number;
}){
 if(!open)return null;
 return <div
  style={{
   position:"fixed",inset:0,backgroundColor:"rgba(11, 16, 15, 0.45)",backdropFilter:"blur(4px)",
   display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:"16px"
  }}
  onClick={e=>{if(e.target===e.currentTarget)onClose();}}
 >
  <div
   className="workspace-modal platform-card"
   style={{
    background:"var(--panel, #ffffff)",border:"1px solid var(--line)",borderRadius:"8px",
    width:"100%",maxWidth:`${maxWidth}px`,padding:"24px",boxShadow:"0 20px 48px rgba(0,0,0,0.18)",
    maxHeight:"90vh",overflowY:"auto"
   }}
  >
   <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"16px"}}>
    <div>
     <h3 style={{margin:"0 0 4px 0",fontSize:"17px",color:"var(--ink)"}}>{title}</h3>
     {subtitle&&<p style={{margin:0,fontSize:"12px",color:"var(--muted)"}}>{subtitle}</p>}
    </div>
    <button
     type="button"
     onClick={onClose}
     style={{background:"transparent",border:"none",cursor:"pointer",padding:"4px",color:"var(--muted)"}}
     title="Close dialog"
    >
     <X size={18}/>
    </button>
   </div>
   {children}
  </div>
 </div>;
}

function QrModal({
 item,
 onClose
}:{
 item:{title:string;roomNumber?:string;propertyName?:string;url:string}|null;
 onClose:()=>void;
}){
 const [dataUrl,setDataUrl]=useState("");
 const [copied,setCopied]=useState(false);

 useEffect(()=>{
  if(item?.url){
   QRCode.toDataURL(item.url,{width:300,margin:2,color:{dark:"#0b100f",light:"#ffffff"}})
    .then(setDataUrl)
    .catch(console.error);
  }
 },[item?.url]);

 if(!item)return null;

 return <Modal open={true} title="Guest Feedback Code / QR" subtitle={`Scan or open direct feedback for ${item.title}`} onClose={onClose} maxWidth={460}>
  <div style={{textAlign:"center",padding:"10px 0"}}>
   {dataUrl?(
    <img src={dataUrl} alt="Feedback QR Code" style={{width:"200px",height:"200px",margin:"0 auto",borderRadius:"8px",border:"1px solid var(--line)",display:"block"}}/>
   ):(
    <div style={{width:"200px",height:"200px",margin:"0 auto",background:"var(--canvas)",display:"flex",alignItems:"center",justifyContent:"center"}}>
     Generating QR code…
    </div>
   )}
   <div style={{marginTop:"14px"}}>
    <strong style={{display:"block",fontSize:"15px",color:"var(--ink)"}}>{item.title}</strong>
    {item.propertyName&&<small style={{color:"var(--muted)"}}>{item.propertyName}</small>}
   </div>
   <div style={{marginTop:"16px",display:"flex",flexDirection:"column",gap:"8px"}}>
    <button
     type="button"
     className="button button-dark"
     style={{width:"100%",justifyContent:"center",display:"inline-flex",alignItems:"center",gap:"6px"}}
     onClick={()=>{window.open(item.url,"_blank");}}
    >
     <ExternalLink size={14}/>
     <span>Open Feedback Form Now ↗</span>
    </button>
    <button
     type="button"
     className="button button-outline"
     style={{width:"100%",justifyContent:"center",display:"inline-flex",alignItems:"center",gap:"6px"}}
     onClick={async()=>{
      await navigator.clipboard.writeText(item.url);
      setCopied(true);
      setTimeout(()=>setCopied(false),2000);
     }}
    >
     {copied?<Check size={14}/>:<ClipboardCheck size={14}/>}
     <span>{copied?"Link Copied!":"Copy Feedback Link"}</span>
    </button>
   </div>
  </div>
 </Modal>;
}

function GuestForm({guest,save,cancel}:{guest:any;save:Save;cancel:()=>void}){
 return <form key={guest?.id||"new"} className="platform-fields" onSubmit={async e=>{
  e.preventDefault();const form=e.currentTarget,fields=Object.fromEntries(new FormData(form));
  if(await save({action:"guest",...fields,...(guest?{id:guest.id}:{})},guest?"PATCH":"POST")){form.reset();cancel();}
 }}>
 <label>Guest name<input name="full_name" defaultValue={guest?.full_name||""} required maxLength={100} placeholder="e.g. John Doe"/></label>
 <label>Email<input name="email" type="email" defaultValue={guest?.email||""} placeholder="guest@example.com"/></label>
 <label>Phone<input name="phone" defaultValue={guest?.phone||""} maxLength={40} placeholder="+1 555-0199"/></label>
 <label>Guest tier<WorkspaceSelect label="Guest tier" name="vip_tier" defaultValue={guest?.vip_tier||"Standard"} options={stateOptions(["Standard","Returning","VIP"])}/></label>
 <label className="hotel-wide-field">Stay preferences<input name="preferences" defaultValue={guest?.preferences||""} maxLength={2000} placeholder="Accessibility, room, or service preferences"/></label>
 <button className="button button-dark">{guest?"Update guest":"Add guest profile"}</button>{guest&&<button type="button" className="button button-ghost" onClick={cancel}>Cancel editing</button>}
 </form>;
}

function JobForm({
 data,
 save,
 initialProperty="",
 onSuccess,
 onOpenRoomManager
}:{
 data:any;
 save:Save;
 initialProperty?:string;
 onSuccess?:()=>void;
 onOpenRoomManager?:(propertyId:string)=>void;
}){
 const [property,setProperty]=useState(initialProperty||"");
 const [room,setRoom]=useState("");
 const [source,setSource]=useState("");
 const [title,setTitle]=useState("");

 useEffect(()=>{
  if(initialProperty&&initialProperty!=="all"&&!property){
   setProperty(initialProperty);
  }
 },[initialProperty,property]);

 const rooms=(data?.rooms||[]).filter((r:any)=>r.property_id===property);
 const team=(data?.team||[]).filter((p:any)=>property?(p.property_id===property||(Array.isArray(p.property_ids)&&p.property_ids.includes(property))):true);

 return <form className="platform-fields" onSubmit={async e=>{
  e.preventDefault();if(!property){return;}
  const form=e.currentTarget,fields=Object.fromEntries(new FormData(form));
  const deadline=String(fields.due_at||"");
  if(await save({action:"job",...fields,property_id:property,room_id:room,feedback_id:source,title,due_at:deadline?new Date(deadline).toISOString():undefined})){
   form.reset();setTitle("");setRoom("");setSource("");
   if(onSuccess)onSuccess();
  }
 }}>
 <label>Property<WorkspaceSelect label="Job property" value={property} onChange={id=>{setProperty(id);setRoom("");setSource("");}} placeholder="Choose property" options={(data?.properties||[]).filter((p:any)=>p.is_active).map((p:any)=>({value:p.id,label:p.name}))}/></label>
 <div>
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"4px"}}>
   <label style={{margin:0,fontSize:"12px"}}>Room · optional</label>
   {onOpenRoomManager&&property&&(
    <button
     type="button"
     onClick={()=>onOpenRoomManager(property)}
     style={{background:"none",border:"none",color:"var(--ink)",fontSize:"11px",textDecoration:"underline",cursor:"pointer",padding:0}}
    >
     + Add / Import Rooms
    </button>
   )}
  </div>
  <WorkspaceSelect label="Job room" value={room} onChange={setRoom} options={[{value:"",label:"No specific room / General"},...rooms.map((r:any)=>({value:r.id,label:r.room_number+(r.room_type?` (${r.room_type})`:"")}))]}/>
  {property&&rooms.length===0&&(
   <div style={{marginTop:"6px",padding:"8px 10px",background:"rgba(234, 88, 12, 0.08)",border:"1px solid rgba(234, 88, 12, 0.25)",borderRadius:"5px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:"8px"}}>
    <span style={{fontSize:"11px",color:"var(--ink)"}}>No rooms configured for this property yet.</span>
    {onOpenRoomManager&&(
     <button
      type="button"
      className="button button-dark compact"
      onClick={()=>onOpenRoomManager(property)}
      style={{fontSize:"11px",padding:"2px 8px",display:"inline-flex",alignItems:"center",gap:"4px"}}
     >
      <Plus size={11}/>
      <span>Add Rooms</span>
     </button>
    )}
   </div>
  )}
 </div>
 <label>Job type<WorkspaceSelect label="Job type" name="kind" defaultValue="guest_request" options={[{value:"guest_request",label:"Guest request"},{value:"cleaning",label:"Cleaning / Turnover"},{value:"maintenance",label:"Maintenance / Repair"},{value:"inspection",label:"Room inspection"}]}/></label>
 <label>Title<input value={title} onChange={e=>setTitle(e.target.value)} required maxLength={160} placeholder="e.g. Extra pillows, AC not cooling, Turnover clean"/></label>
 <label>Priority<WorkspaceSelect label="Job priority" name="priority" defaultValue="normal" options={stateOptions(["low","normal","high","critical"])}/></label>
 <label>Assign to · optional<WorkspaceSelect key={property} label="Job assignee" name="assigned_to" options={[{value:"",label:property&&team.length===0?"Unassigned (No staff assigned to this property)":"Unassigned / Auto-dispatch"},...team.map((p:any)=>({value:p.id,label:p.full_name}))]}/></label>
 <label>Deadline · optional<WorkspaceDateField name="due_at" label="Job deadline" mode="datetime"/></label>
 <label>Link an open feedback case · optional<WorkspaceSelect label="Feedback source" value={source} onChange={id=>{setSource(id);const item=(data?.feedback||[]).find((f:any)=>f.id===id);if(item){setProperty(item.property_id);setRoom(rooms.find((r:any)=>r.property_id===item.property_id&&r.room_number===item.room_number)?.id||"");setTitle("Guest feedback · "+item.department);}}} options={[{value:"",label:"No feedback source"},...(data?.feedback||[]).filter((f:any)=>!property||f.property_id===property).map((f:any)=>({value:f.id,label:f.department+" · Room "+f.room_number+" · "+f.rating+"/5"}))]}/></label>
 <label className="hotel-wide-field">Details / Instructions<input name="description" maxLength={2000} placeholder="Provide specific requirements, location details, or special requests"/></label>
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
 const [guestTab,setGuestTab]=useState<"in_house"|"reserved"|"history"|"profiles">("in_house");
 const [showJobModal,setShowJobModal]=useState(false);
 const [showReserveModal,setShowReserveModal]=useState(false);
 const [showRoomManagerModal,setShowRoomManagerModal]=useState(false);
 const [roomManagerPropertyId,setRoomManagerPropertyId]=useState("");
 const [qrModalData,setQrModalData]=useState<{title:string;roomNumber?:string;propertyName?:string;url:string}|null>(null);
 const sequence=useRef(0);

 async function load(){
  const ticket=++sequence.current;setLoading(true);
  try{
   const response=await fetch("/api/hospitality?"+new URLSearchParams({property,month,search,jobs:jobView,complaints:String(tab==="Complaints")}),{cache:"no-store"}),json=await response.json();
   if(!response.ok)throw new Error(json.error||"Could not load hotel operations.");
   if(ticket===sequence.current){setData(json);setError("");}
  }catch(error){if(ticket===sequence.current)setError((error as Error).message);}
  finally{if(ticket===sequence.current)setLoading(false);}
 }
 useEffect(()=>{const timer=setTimeout(()=>load(),200);return()=>clearTimeout(timer);},[property,month,search,jobView,tab]);
 useEffect(()=>{const timer=setInterval(()=>{if(!document.hidden&&!busy)load();},30000);return()=>clearInterval(timer);},[property,month,search,jobView,tab,busy]);

 async function save(body:any,method="POST"){
  setBusy(true);setError("");setMessage("");
  try{
   const response=await fetch("/api/hospitality",{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}),json=await response.json();
   if(!response.ok)throw new Error(json.error||"Could not save changes.");
   if(body.action==="inspection"){
    setMessage(json.result.passed?"Inspection passed. Room readiness updated.":"Inspection recorded. A maintenance follow-up was created.");
   }else if(body.action==="stay"&&body.status==="checked_out"){
    setMessage("Guest checked out successfully. Room has been marked dirty for housekeeping turnover.");
   }else if(body.action==="job"){
    setMessage(method==="PATCH"?"Service job updated successfully.":"Service job created successfully.");
   }else{
    setMessage("Saved successfully.");
   }
   await load();return true;
  }catch(error){setError((error as Error).message);return false;}
  finally{setBusy(false);}
 }

 function getStayFeedbackUrl(stay:any){
  const origin=typeof window!=="undefined"?window.location.origin:"";
  if(stay?.public_token)return `${origin}/feedback/${stay.public_token}`;
  const params=new URLSearchParams();
  if(stay?.property_id)params.set("property",stay.property_id);
  if(stay?.room_number)params.set("room",stay.room_number);
  params.set("source","hotel_ops");
  return `${origin}/feedback?${params.toString()}`;
 }

 function getRoomFeedbackUrl(room:any){
  const origin=typeof window!=="undefined"?window.location.origin:"";
  const params=new URLSearchParams();
  if(room?.property_id)params.set("property",room.property_id);
  if(room?.room_number)params.set("room",room.room_number);
  params.set("source","room_qr");
  return `${origin}/feedback?${params.toString()}`;
 }

 function openFeedbackForStay(stay:any){
  const url=getStayFeedbackUrl(stay);
  window.open(url,"_blank");
 }

 function openFeedbackForRoom(room:any){
  const url=getRoomFeedbackUrl(room);
  window.open(url,"_blank");
 }

 function showStayQr(stay:any){
  const guestName=stay.guests?.full_name||"Guest";
  const roomText=stay.room_number?`Room ${stay.room_number}`:"General";
  const propName=data?.properties?.find((p:any)=>p.id===stay.property_id)?.name||"Vistora Hotel";
  setQrModalData({
   title:`${guestName} · ${roomText}`,
   roomNumber:stay.room_number,
   propertyName:propName,
   url:getStayFeedbackUrl(stay)
  });
 }

 function showRoomQr(room:any){
  const propName=data?.properties?.find((p:any)=>p.id===room.property_id)?.name||"Vistora Hotel";
  setQrModalData({
   title:`Room ${room.room_number} (${room.room_type||"Standard"})`,
   roomNumber:room.room_number,
   propertyName:propName,
   url:getRoomFeedbackUrl(room)
  });
 }

 function openGeneralFeedbackCode(){
  const origin=typeof window!=="undefined"?window.location.origin:"";
  const selectedProp=(data?.properties||[]).find((p:any)=>p.id===property);
  const params=new URLSearchParams();
  if(property!=="all")params.set("property",property);
  params.set("source","hotel_check_code");
  const queryStr=params.toString();
  const url=`${origin}/feedback${queryStr?`?${queryStr}`:""}`;
  setQrModalData({
   title:selectedProp?`Guest Feedback · ${selectedProp.name}`:"General Guest Feedback",
   propertyName:selectedProp?.name||"All Properties",
   url
  });
 }

 const config=hospitalityConfig(data?.config||appearance.config);
 const canManage=user.isOrganizationAdmin===true;
 const canCreateJob=canManage||canManageServiceJobs(user);
 const canAttend=canManageServiceJobs(user)&&data?.complaintsReady===true;
 const descriptions:Record<Tab,string>={
  Overview:"A clear view of guest stays, room readiness, and immediate service requests.",
  Guests:"Track active in-house guests, handle checkouts, manage reservations, and customer profiles.",
  Rooms:"Configure rooms for each property, track readiness, and generate room feedback codes.",
  Complaints:"Log an issue, route it to the right department and follow every escalation.",
  "Service jobs":"Coordinate guest requests and service work across your properties.",
  Inspections:"Review room checks and follow up on readiness issues.",
  "Cost controls":"Review operating costs, approvals and monthly budgets."
 };
 const sectionKey=tab==="Guests"?"guests":tab==="Rooms"?"property":tab==="Inspections"?"compliance":"operations";
 const enabled=tab==="Overview"||config.modules[sectionKey as keyof typeof config.modules]!==false;
 const propertySelect=(name="property_id")=><WorkspaceSelect label="Property" name={name} defaultValue={property==="all"?"":property} placeholder="Choose property" options={(data?.properties||[]).filter((p:any)=>p.is_active).map((p:any)=>({value:p.id,label:p.name}))}/>;
 const roomOptions=(data?.rooms||[]).map((r:any)=>({value:r.id,label:r.room_number+" · "+(data.properties.find((p:any)=>p.id===r.property_id)?.name||"")+" · "+label(r.status)}));
 const nameOf=(id:string)=>data?.properties.find((p:any)=>p.id===id)?.name||"—";
 const roomOf=(id:string)=>data?.rooms.find((r:any)=>r.id===id)?.room_number||"—";
 const submit=(action:string)=>(e:FormEvent<HTMLFormElement>)=>{
  e.preventDefault();const form=e.currentTarget,fields=Object.fromEntries(new FormData(form));
  save({action,...fields}).then(ok=>{if(ok)form.reset();});
 };

 const stays:any[]=data?.stays||[];
 const activeStays=stays.filter(s=>s.status==="active");
 const reservedStays=stays.filter(s=>s.status==="reserved");
 const historyStays=stays.filter(s=>s.status==="checked_out"||s.status==="cancelled");

 const cards=[
  {title:"Guests in house · active",value:data?.metrics.inHouse??activeStays.length,section:"Guests"},
  {title:"Open service jobs",value:data?.metrics.openJobs,section:"Service jobs"},
  {title:"Rooms needing service",value:data?.metrics.roomsNeedService,section:"Rooms"},
  {title:"Guest profiles · company",value:data?.metrics.guests,section:"Guests"},
  {title:"Pending cost decisions",value:data?.metrics.pendingCosts,section:"Cost controls"}
 ];

 return <AppShell active={tab} user={user} module="operations"><div className="content-wrap platform-page hotel-page">
 <DashboardPageHeading eyebrow="Hotel operations" title={tab} description={descriptions[tab]}>
  <PropertyFilter properties={data?.properties||[]} selectedId={property} onChange={setProperty} manageHref="/dashboard/properties?workspace=operations"/>
  <button
   type="button"
   className="button button-dark compact"
   onClick={()=>setShowJobModal(true)}
   style={{display:"inline-flex",alignItems:"center",gap:"5px"}}
   title="Create a new job request / service job"
  >
   <Plus size={14}/>
   <span>New Job Request</span>
  </button>
  <button
   type="button"
   className="button button-outline compact"
   onClick={()=>{
    setRoomManagerPropertyId(property!=="all"?property:"");
    setShowRoomManagerModal(true);
   }}
   style={{display:"inline-flex",alignItems:"center",gap:"5px"}}
   title="Create or bulk import rooms for properties"
  >
   <BedDouble size={14}/>
   <span>+ Add / Import Rooms</span>
  </button>
  <button
   type="button"
   className="button button-ghost compact"
   onClick={openGeneralFeedbackCode}
   style={{display:"inline-flex",alignItems:"center",gap:"5px"}}
   title="Check code / QR for guest feedback"
  >
   <QrCode size={14}/>
   <span>Feedback Code</span>
  </button>
  <button className="button button-ghost compact" disabled={loading} onClick={load}><RefreshCw size={14}/>Refresh</button>
 </DashboardPageHeading>
 <nav className="platform-tabs" aria-label="Hotel modules">{tabs.filter(t=>canManage||t!=="Cost controls").map(t=><button key={t} aria-current={t===tab?"page":undefined} onClick={()=>setTab(t)}>{t}</button>)}</nav>
 {!canManage&&<p className="platform-notice">{canAttend?"You can log complaints and attend your assigned work. Inventory, stays and costs remain administrator-only.":"Read-only access to your assigned properties. Ask an administrator for complaint intake and assigned work permission."}</p>}
 {error&&<p role="alert" className="platform-notice">{error}</p>}{message&&<p role="status" className="hotel-success">{message}</p>}
 {loading&&!data&&<p role="status">Loading hotel operations…</p>}
 {data&&<>{(tab==="Guests"||tab==="Cost controls")&&<div className="hotel-filter">{tab==="Guests"&&<label>Find a guest<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search guest name"/></label>}{tab==="Cost controls"&&<label>Ledger month<WorkspaceDateField label="Ledger month" mode="month" value={month} onChange={value=>{if(value)setMonth(value);}} required/></label>}</div>}
 {!enabled?<section className="platform-card"><h2>Module disabled</h2><p>Existing records are retained. Enable this module in workspace Settings to continue.</p>{canManage&&<Link className="button button-dark" href="/dashboard">Open workspace</Link>}</section>:<>
 {(tab==="Service jobs"||tab==="Complaints")&&<div className="hotel-filter"><label>Service board view<WorkspaceSelect label="Service board view" value={jobView} onChange={setJobView} options={[{value:"active",label:"Open and in progress"},{value:"closed",label:"Completed and cancelled"}]}/></label></div>}
 {tab==="Complaints"&&<ComplaintBoard data={data} user={user} save={save} busy={busy}/>}
 {tab==="Overview"&&(()=>{
  const filteredRooms=(data.rooms||[]).filter((r:any)=>property==="all"||r.property_id===property);
  const totalRooms=filteredRooms.length;
  const activeStayRoomIds=new Set(activeStays.map((s:any)=>s.room_id).filter(Boolean));
  const occupiedRooms=filteredRooms.filter((r:any)=>activeStayRoomIds.has(r.id)).length;
  const inspectedRooms=filteredRooms.filter((r:any)=>!activeStayRoomIds.has(r.id)&&r.status==="inspected").length;
  const cleanRooms=filteredRooms.filter((r:any)=>!activeStayRoomIds.has(r.id)&&r.status==="clean").length;
  const readyRooms=inspectedRooms+cleanRooms;
  const dirtyRooms=filteredRooms.filter((r:any)=>r.status==="dirty").length;
  const outOfServiceRooms=filteredRooms.filter((r:any)=>r.status==="out_of_service").length;
  const readyPct=totalRooms>0?Math.round((readyRooms/totalRooms)*100):0;
  const occupiedPct=totalRooms>0?Math.round((occupiedRooms/totalRooms)*100):0;
  const dirtyPct=totalRooms>0?Math.round((dirtyRooms/totalRooms)*100):0;
  const outOfServicePct=totalRooms>0?Math.max(0,100-readyPct-occupiedPct-dirtyPct):0;

  const activeJobs=(data.jobs||[]).filter((j:any)=>["open","in_progress"].includes(j.status));
  const filteredActiveJobs=activeJobs.filter((j:any)=>property==="all"||j.property_id===property);
  const totalActiveJobs=filteredActiveJobs.length;
  const criticalJobs=filteredActiveJobs.filter((j:any)=>j.priority==="critical").length;
  const highJobs=filteredActiveJobs.filter((j:any)=>j.priority==="high").length;
  const normalJobs=filteredActiveJobs.filter((j:any)=>j.priority==="normal").length;
  const lowJobs=filteredActiveJobs.filter((j:any)=>j.priority==="low").length;
  const critPct=totalActiveJobs>0?(criticalJobs/totalActiveJobs)*100:0;
  const highPct=totalActiveJobs>0?(highJobs/totalActiveJobs)*100:0;
  const normPct=totalActiveJobs>0?(normalJobs/totalActiveJobs)*100:0;
  const lowPct=totalActiveJobs>0?(lowJobs/totalActiveJobs)*100:0;
  const guestReqJobs=filteredActiveJobs.filter((j:any)=>j.kind==="guest_request").length;
  const cleanTurnoverJobs=filteredActiveJobs.filter((j:any)=>j.kind==="cleaning").length;

  const formatDeadline=(dueAt?:string)=>{
   if(!dueAt)return null;
   const due=new Date(dueAt).getTime();
   const diffMins=Math.round((due-Date.now())/60000);
   const isOverdue=diffMins<0;
   const absMins=Math.abs(diffMins);
   let text="";
   if(absMins<60){
    text=`${absMins}m ${isOverdue?"overdue":"left"}`;
   }else if(absMins<1440){
    text=`${Math.round(absMins/60)}h ${isOverdue?"overdue":"left"}`;
   }else{
    text=new Date(dueAt).toLocaleDateString(undefined,{month:"short",day:"numeric"});
   }
   return{isOverdue,text};
  };

  const getTicketLabel=(kind:string)=>{
   switch(kind){
    case "cleaning":return "Housekeeping";
    case "maintenance":return "Maintenance";
    case "inspection":return "Inspection";
    default:return "Guest Request";
   }
  };

  return <>
   <section className="platform-stats" aria-label="Operations summary">
    {cards.filter(c=>canManage||c.section!=="Cost controls").map(c=><button key={c.title} onClick={()=>setTab(c.section as Tab)} type="button" className="platform-stat hotel-metric-link"><span>{c.title}</span><strong>{c.value??"—"}</strong></button>)}
   </section>

   <div className="hotel-overview-content">
     {/* Visual Analytics Graphs */}
     <section className="platform-card hotel-capacity">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:"10px",marginBottom:"14px"}}>
       <div>
        <h2 style={{margin:0,fontSize:"15px",fontWeight:600,display:"flex",alignItems:"center",gap:"6px"}}>
         <span>Room readiness &amp; service workload</span>
        </h2>
        <p style={{margin:"2px 0 0 0",fontSize:"12px",color:"var(--muted)"}}>
         {property==="all"?"Aggregated across all properties":`Scoped to ${nameOf(property)}`}
        </p>
       </div>
       <span style={{fontSize:"11px",color:"var(--muted)",background:"var(--canvas)",padding:"3px 8px",borderRadius:"4px",border:"1px solid var(--line)"}}>
        {totalRooms} Rooms · {totalActiveJobs} Active Tasks
       </span>
      </div>

      <div className="hotel-charts-grid">
       {/* Graph 1: Room Readiness & Occupancy */}
       <div className="hotel-chart-card">
        <div className="hotel-chart-header">
         <div>
          <h3>Room readiness</h3>
          <p>{totalRooms>0?`${readyRooms} ready for guests (${readyPct}%)`:"No rooms configured"}</p>
         </div>
         <div className="hotel-chart-stat">
          {totalRooms>0?`${readyPct}%`:"—"}
          <small>{readyRooms} of {totalRooms} ready</small>
         </div>
        </div>

        {totalRooms>0?(
         <>
          <div className="hotel-progress-stacked" title={`Ready: ${readyRooms}, Occupied: ${occupiedRooms}, Dirty: ${dirtyRooms}, Out of service: ${outOfServiceRooms}`}>
           {inspectedRooms>0&&<div className="hotel-progress-segment" style={{width:`${(inspectedRooms/totalRooms)*100}%`,background:"#10b981"}} title={`Inspected & Ready: ${inspectedRooms}`}/>}
           {cleanRooms>0&&<div className="hotel-progress-segment" style={{width:`${(cleanRooms/totalRooms)*100}%`,background:"#14b8a6"}} title={`Clean: ${cleanRooms}`}/>}
           {occupiedRooms>0&&<div className="hotel-progress-segment" style={{width:`${(occupiedRooms/totalRooms)*100}%`,background:"#3b82f6"}} title={`Occupied: ${occupiedRooms}`}/>}
           {dirtyRooms>0&&<div className="hotel-progress-segment" style={{width:`${(dirtyRooms/totalRooms)*100}%`,background:"#f59e0b"}} title={`Dirty / Needs Turnover: ${dirtyRooms}`}/>}
           {outOfServiceRooms>0&&<div className="hotel-progress-segment" style={{width:`${(outOfServiceRooms/totalRooms)*100}%`,background:"#f43f5e"}} title={`Out of Service / Repair: ${outOfServiceRooms}`}/>}
          </div>

          <div className="hotel-chart-legend">
           <div className="hotel-legend-item">
            <span className="hotel-legend-item-label">
             <span className="hotel-legend-dot" style={{background:"#10b981"}}/>
             Ready / Clean
            </span>
            <strong>{readyRooms} ({readyPct}%)</strong>
           </div>
           <div className="hotel-legend-item">
            <span className="hotel-legend-item-label">
             <span className="hotel-legend-dot" style={{background:"#3b82f6"}}/>
             Occupied
            </span>
            <strong>{occupiedRooms} ({occupiedPct}%)</strong>
           </div>
           <div className="hotel-legend-item">
            <span className="hotel-legend-item-label">
             <span className="hotel-legend-dot" style={{background:"#f59e0b"}}/>
             Needs Cleaning
            </span>
            <strong>{dirtyRooms} ({dirtyPct}%)</strong>
           </div>
           <div className="hotel-legend-item">
            <span className="hotel-legend-item-label">
             <span className="hotel-legend-dot" style={{background:"#f43f5e"}}/>
             Maintenance
            </span>
            <strong>{outOfServiceRooms} ({outOfServicePct}%)</strong>
           </div>
          </div>
         </>
        ):(
         <div style={{textAlign:"center",padding:"16px 8px",background:"var(--canvas)",borderRadius:"4px",border:"1px dashed var(--line)"}}>
          <p style={{margin:"0 0 8px 0",fontSize:"11px",color:"var(--muted)"}}>No rooms configured for this property.</p>
          <button
           type="button"
           className="button button-outline compact"
           onClick={()=>{
            setRoomManagerPropertyId(property!=="all"?property:"");
            setShowRoomManagerModal(true);
           }}
           style={{fontSize:"11px"}}
          >
           + Add / Import Rooms
          </button>
         </div>
        )}
       </div>

       {/* Graph 2: Service Job Dispatch Workload */}
       <div className="hotel-chart-card">
        <div className="hotel-chart-header">
         <div>
          <h3>Service workload</h3>
          <p>{totalActiveJobs>0?`${criticalJobs+highJobs} urgent priority`:"All service tickets closed"}</p>
         </div>
         <div className="hotel-chart-stat">
          {totalActiveJobs}
          <small>active tickets</small>
         </div>
        </div>

        {totalActiveJobs>0?(
         <>
          <div className="hotel-progress-stacked" title={`Critical: ${criticalJobs}, High: ${highJobs}, Normal: ${normalJobs}, Low: ${lowJobs}`}>
           {criticalJobs>0&&<div className="hotel-progress-segment" style={{width:`${critPct}%`,background:"#ef4444"}} title={`Critical: ${criticalJobs}`}/>}
           {highJobs>0&&<div className="hotel-progress-segment" style={{width:`${highPct}%`,background:"#f97316"}} title={`High: ${highJobs}`}/>}
           {normalJobs>0&&<div className="hotel-progress-segment" style={{width:`${normPct}%`,background:"#3b82f6"}} title={`Normal: ${normalJobs}`}/>}
           {lowJobs>0&&<div className="hotel-progress-segment" style={{width:`${lowPct}%`,background:"#94a3b8"}} title={`Low: ${lowJobs}`}/>}
          </div>

          <div className="hotel-chart-legend">
           <div className="hotel-legend-item">
            <span className="hotel-legend-item-label">
             <span className="hotel-legend-dot" style={{background:"#ef4444"}}/>
             Critical / High
            </span>
            <strong>{criticalJobs+highJobs}</strong>
           </div>
           <div className="hotel-legend-item">
            <span className="hotel-legend-item-label">
             <span className="hotel-legend-dot" style={{background:"#3b82f6"}}/>
             Normal / Low
            </span>
            <strong>{normalJobs+lowJobs}</strong>
           </div>
           <div className="hotel-legend-item">
            <span className="hotel-legend-item-label">Guest Requests</span>
            <strong>{guestReqJobs}</strong>
           </div>
           <div className="hotel-legend-item">
            <span className="hotel-legend-item-label">Housekeeping</span>
            <strong>{cleanTurnoverJobs}</strong>
           </div>
          </div>
         </>
        ):(
         <div style={{textAlign:"center",padding:"16px 8px",background:"var(--canvas)",borderRadius:"4px",border:"1px dashed var(--line)"}}>
          <p style={{margin:"0 0 8px 0",fontSize:"11px",color:"var(--muted)"}}>No active service jobs in queue.</p>
         </div>
        )}
       </div>
      </div>
     </section>

     {/* Live Active Service Tickets Queue */}
     <section className="platform-card hotel-queue-card">
      <div className="hotel-queue-header">
       <div className="hotel-queue-title-area">
        <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
         <h2 style={{margin:0,fontSize:"15px",display:"flex",alignItems:"center",gap:"6px"}}>
          <span>Active service jobs</span>
         </h2>
         <span style={{fontSize:"11px",fontWeight:600,padding:"1px 6px",borderRadius:"3px",background:"var(--ink)",color:"var(--panel)"}}>
          {totalActiveJobs}
         </span>
        </div>
        <p style={{margin:"2px 0 0 0",fontSize:"12px",color:"var(--muted)"}}>
         Assign, start and complete service requests.
        </p>
       </div>
       <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
        <button
         type="button"
         className="button button-dark compact"
         onClick={()=>setShowJobModal(true)}
         style={{display:"inline-flex",alignItems:"center",gap:"4px"}}
        >
         <Plus size={13}/>
         <span>New job</span>
        </button>
        <button
         type="button"
         className="button button-outline compact"
         onClick={()=>setTab("Service jobs")}
         style={{display:"inline-flex",alignItems:"center",gap:"4px"}}
        >
         <span>View all jobs</span>
        </button>
       </div>
      </div>

      {totalActiveJobs===0?(
       <div style={{padding:"28px 16px",textAlign:"center",background:"var(--canvas)",borderRadius:"6px",border:"1px dashed var(--line)"}}>
        <h3 style={{fontSize:"14px",fontWeight:600,margin:"0 0 4px 0"}}>No active service jobs</h3>
        <p style={{fontSize:"12px",color:"var(--muted)",maxWidth:"340px",margin:"0 auto 12px auto"}}>
         All guest requests, housekeeping turnovers, and maintenance tickets are complete.
        </p>
       </div>
      ):(
       <div className="hotel-tickets-list">
        {filteredActiveJobs.map((j:any)=>{
         const deadline=formatDeadline(j.due_at);
         const propTeam=(data.team||[]).filter((p:any)=>j.property_id?(p.property_id===j.property_id||(Array.isArray(p.property_ids)&&p.property_ids.includes(j.property_id))):true);
         return (
          <div className={`hotel-ticket-item priority-${j.priority}`} key={j.id}>
           <div className="hotel-ticket-top">
            <div className="hotel-ticket-badges">
             <span className="hotel-badge badge-kind">
              <span>{getTicketLabel(j.kind)}</span>
             </span>
             <span className={`hotel-badge priority-${j.priority}`}>
              {label(j.priority)}
             </span>
             <span
              className="hotel-badge"
              style={{
               background:j.status==="in_progress"?"var(--sage-soft)":"var(--canvas)",
               color:j.status==="in_progress"?"var(--sage-deep)":"var(--muted)",
               border:"1px solid var(--line)"
              }}
             >
              {j.status==="in_progress"?"In Progress":"Waiting Dispatch"}
             </span>
            </div>
            {deadline&&(
             <span className={`hotel-ticket-due ${deadline.isOverdue?"overdue":""}`}>
              <span>{deadline.isOverdue?"Overdue":"Due"} · {deadline.text}</span>
             </span>
            )}
           </div>

           <div className="hotel-ticket-body">
            <div className="hotel-ticket-title-row">
             <h4 className="hotel-ticket-title">{j.title}</h4>
             <span className="hotel-ticket-room">
              {roomOf(j.room_id)!=="—"?`Room ${roomOf(j.room_id)}`:"General Area"} · {nameOf(j.property_id)}
             </span>
            </div>
            {j.description&&(
             <p className="hotel-ticket-desc">{j.description}</p>
            )}
           </div>

           <div className="hotel-ticket-footer">
            <div className="hotel-ticket-assignee">
             <span style={{fontSize:"11px",color:"var(--muted)"}}>Assignee:</span>
             {canManage&&["open","in_progress"].includes(j.status)?(
              <div style={{minWidth:"150px"}}>
               <WorkspaceSelect
                label={"Assign "+j.title}
                disabled={busy}
                value={j.assigned_to||""}
                placeholder={j.assignee?.full_name||"Unassigned"}
                options={[
                 {value:"",label:propTeam.length===0?"Unassigned (No staff assigned)":"Unassigned"},
                 ...propTeam.map((p:any)=>({value:p.id,label:p.full_name}))
                ]}
                onChange={assigned_to=>save({action:"job",id:j.id,assigned_to},"PATCH")}
               />
              </div>
             ):(
              <strong style={{fontSize:"11px",color:j.assigned_to?"var(--ink)":"var(--muted)"}}>
               {j.assignee?.full_name||"Unassigned / Auto-dispatch"}
              </strong>
             )}
            </div>

            <div className="hotel-ticket-actions">
             {(canManage||(canAttend&&j.assigned_to===user.id))&&["open","in_progress"].includes(j.status)&&(
              <>
               {j.status==="open"&&(
                <button
                 type="button"
                 className="button button-ghost compact"
                 disabled={busy}
                 onClick={()=>save({action:"job",id:j.id,status:"in_progress"},"PATCH")}
                >
                 Start
                </button>
               )}
               <button
                type="button"
                className="button button-dark compact"
                disabled={busy}
                onClick={()=>save({action:"job",id:j.id,status:"completed"},"PATCH")}
                style={{display:"inline-flex",alignItems:"center",gap:"4px"}}
               >
                <span>Complete</span>
               </button>
              </>
             )}
            </div>
           </div>
          </div>
         );
        })}
       </div>
      )}
     </section>
   </div>
     <section className="platform-card hotel-recent-activity">
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"4px"}}>
       <h3 style={{fontSize:"13px",fontWeight:600,margin:0,display:"flex",alignItems:"center",gap:"6px"}}>
        <span>Recent activity</span>
       </h3>
       <span style={{fontSize:"10px",color:"var(--muted)"}}>{data.activity?.length||0} events</span>
      </div>
      <p style={{fontSize:"11px",color:"var(--muted)",margin:"0 0 10px 0"}}>Recent operational changes</p>
      <div className="hotel-activity-list">
       {!data.activity?.length?(
        <p style={{fontSize:"12px",color:"var(--muted)",margin:0,padding:"12px 0",textAlign:"center"}}>
         {canManage?"No operational changes recorded yet.":"Activity history is available to administrators."}
        </p>
       ):(
        data.activity.map((a:any)=>(
         <div className="hotel-activity-item" key={a.id}>
          <div className="hotel-activity-header">
           <span className="hotel-activity-title">{label(a.entity_type)} · {a.action}</span>
           <time style={{fontSize:"10px",color:"var(--muted)"}}>{format(a.created_at)}</time>
          </div>
          <div className="hotel-activity-meta">
           <span>ID: {a.entity_id.slice(0,8)}</span>
           <span>{a.actor_id?data.team.find((p:any)=>p.id===a.actor_id)?.full_name||"Staff":"System"}</span>
          </div>
         </div>
        ))
       )}
      </div>
     </section>

  </>;
 })()}

 {tab==="Guests"&&<>
  <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",flexWrap:"wrap",gap:"12px",borderBottom:"1px solid var(--line)",marginBottom:"20px",paddingBottom:"6px"}}>
   <nav className="platform-tabs" aria-label="Guest views" style={{borderBottom:"none",marginBottom:0,paddingBottom:0}}>
    <button
     type="button"
     aria-current={guestTab==="in_house"?"page":undefined}
     onClick={()=>setGuestTab("in_house")}
    >
     In-House Guests ({activeStays.length})
    </button>
    <button
     type="button"
     aria-current={guestTab==="reserved"?"page":undefined}
     onClick={()=>setGuestTab("reserved")}
    >
     Upcoming Reservations ({reservedStays.length})
    </button>
    <button
     type="button"
     aria-current={guestTab==="history"?"page":undefined}
     onClick={()=>setGuestTab("history")}
    >
     Past / Checked-Out ({historyStays.length})
    </button>
    <button
     type="button"
     aria-current={guestTab==="profiles"?"page":undefined}
     onClick={()=>setGuestTab("profiles")}
    >
     Directory ({data.guests?.length||0})
    </button>
   </nav>
   {canManage&&<button
    type="button"
    className="button button-outline compact"
    onClick={()=>setShowReserveModal(true)}
    style={{display:"inline-flex",alignItems:"center",gap:"5px",marginBottom:"2px"}}
   >
    <Calendar size={13}/>
    <span>+ Reserve / Check-In</span>
   </button>}
  </div>

  {/* IN-HOUSE GUESTS: Active stays only */}
  {guestTab==="in_house"&&(
   <section className="platform-card">
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"6px"}}>
     <h2 style={{margin:0}}>In-House Guests (Currently Checked In)</h2>
     <span style={{fontSize:"12px",color:"var(--muted)"}}>{activeStays.length} active stay{activeStays.length===1?"":"s"}</span>
    </div>
    <p>Guests currently staying in your rooms. Once checked out, they are safely moved to history and room is flagged dirty.</p>
    {activeStays.length===0?(
     <div style={{padding:"24px",textAlign:"center",background:"var(--canvas)",borderRadius:"6px",border:"1px dashed var(--line)"}}>
      <p style={{margin:"0 0 10px 0",color:"var(--muted)",fontSize:"13px"}}>No active guests currently checked in. Checked-out guests have been cleared from this view.</p>
      {canManage&&<button className="button button-outline compact" onClick={()=>setShowReserveModal(true)}>Check in a guest</button>}
     </div>
    ):(
     <div className="platform-table">
      <table>
       <thead>
        <tr>
         <th>Guest</th>
         <th>Property &amp; Room</th>
         <th>Stay Dates</th>
         <th>Preferences</th>
         <th>Feedback</th>
         <th style={{textAlign:"right"}}>Actions</th>
        </tr>
       </thead>
       <tbody>
        {activeStays.map((s:any)=>(
         <tr key={s.id}>
          <td>
           <strong>{s.guests?.full_name||"Guest"}</strong>
           <small style={{display:"block",color:"var(--muted)"}}>
            {s.guests?.vip_tier&&<span style={{marginRight:"6px",padding:"1px 4px",borderRadius:"3px",background:"var(--sage-soft)",color:"var(--sage-deep)",fontSize:"10px",fontWeight:600}}>{s.guests.vip_tier}</span>}
            {s.guest_count} guest{s.guest_count===1?"":"s"} · {s.guests?.phone||s.guests?.email||""}
           </small>
          </td>
          <td>
           <strong style={{fontSize:"13px",color:"var(--ink)"}}>Room {s.room_number}</strong>
           <small style={{display:"block",color:"var(--muted)"}}>{nameOf(s.property_id)}</small>
          </td>
          <td>
           <span>{s.check_in_date} → {s.check_out_date}</span>
           <small style={{display:"block",marginTop:"3px"}}>
            <span className="hotel-status inspected" style={{fontSize:"10px",padding:"2px 6px",display:"inline-flex",alignItems:"center",gap:"3px"}}>
             <Check size={10}/> Checked in
            </span>
           </small>
          </td>
          <td className="hotel-wrap" style={{fontSize:"11px",color:"var(--muted)"}}>
           {s.guests?.preferences||"—"}
          </td>
          <td>
           {s.feedback?.length>0?(
            <span style={{color:"var(--sage-deep)",fontWeight:600}}>{s.feedback.map((f:any)=>f.rating+"/5 · "+label(f.status)).join(", ")}</span>
           ):(
            <span style={{color:"var(--muted)",fontSize:"11px"}}>No feedback yet</span>
           )}
          </td>
          <td style={{textAlign:"right"}}>
           <div className="platform-actions" style={{justifyContent:"flex-end",gap:"6px"}}>
            <button
             type="button"
             className="button button-outline compact"
             disabled={busy}
             onClick={()=>save({action:"stay",id:s.id,status:"checked_out"},"PATCH")}
             title="Check out guest now (moves stay to history and marks room dirty for cleaning)"
             style={{display:"inline-flex",alignItems:"center",gap:"4px"}}
            >
             <LogOut size={12}/>
             <span>Check out</span>
            </button>
            <button
             type="button"
             className="button button-ghost compact"
             onClick={()=>openFeedbackForStay(s)}
             title="Take guest feedback directly from here"
             style={{display:"inline-flex",alignItems:"center",gap:"4px"}}
            >
             <ExternalLink size={12}/>
             <span>Feedback ↗</span>
            </button>
            <button
             type="button"
             className="button button-ghost compact"
             onClick={()=>showStayQr(s)}
             title="View feedback QR / check code"
             style={{padding:"4px 6px"}}
            >
             <QrCode size={13}/>
            </button>
           </div>
          </td>
         </tr>
        ))}
       </tbody>
      </table>
     </div>
    )}
   </section>
  )}

  {/* UPCOMING RESERVATIONS */}
  {guestTab==="reserved"&&(
   <section className="platform-card">
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"6px"}}>
     <h2 style={{margin:0}}>Upcoming Reservations</h2>
     <span style={{fontSize:"12px",color:"var(--muted)"}}>{reservedStays.length} reservation{reservedStays.length===1?"":"s"}</span>
    </div>
    <p>Confirmed reservations awaiting check-in. Room readiness is required before check-in.</p>
    {reservedStays.length===0?(
     <p style={{padding:"16px",color:"var(--muted)"}}>No upcoming reservations.</p>
    ):(
     <div className="platform-table">
      <table>
       <thead>
        <tr>
         <th>Guest</th>
         <th>Property &amp; Room</th>
         <th>Arrival / Departure</th>
         <th>Party</th>
         <th style={{textAlign:"right"}}>Actions</th>
        </tr>
       </thead>
       <tbody>
        {reservedStays.map((s:any)=>(
         <tr key={s.id}>
          <td>
           <strong>{s.guests?.full_name||"Guest"}</strong>
           <small style={{display:"block",color:"var(--muted)"}}>{s.guests?.vip_tier||"Standard"}</small>
          </td>
          <td>{nameOf(s.property_id)}<small>Room {s.room_number}</small></td>
          <td>{s.check_in_date} → {s.check_out_date}</td>
          <td>{s.guest_count} guest{s.guest_count===1?"":"s"}</td>
          <td style={{textAlign:"right"}}>
           {canManage&&<div className="platform-actions" style={{justifyContent:"flex-end",gap:"6px"}}>
            <button
             type="button"
             className="button button-outline compact"
             disabled={busy}
             onClick={()=>save({action:"stay",id:s.id,status:"active"},"PATCH")}
             style={{display:"inline-flex",alignItems:"center",gap:"4px"}}
            >
             <Check size={12}/>
             <span>Check in</span>
            </button>
            <button
             type="button"
             className="button button-ghost compact"
             disabled={busy}
             onClick={()=>save({action:"stay",id:s.id,status:"cancelled"},"PATCH")}
            >
             Cancel
            </button>
           </div>}
          </td>
         </tr>
        ))}
       </tbody>
      </table>
     </div>
    )}
   </section>
  )}

  {/* PAST CHECKED-OUT HISTORY */}
  {guestTab==="history"&&(
   <section className="platform-card">
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"6px"}}>
     <h2 style={{margin:0}}>Past / Checked-Out History</h2>
     <span style={{fontSize:"12px",color:"var(--muted)"}}>{historyStays.length} historical record{historyStays.length===1?"":"s"}</span>
    </div>
    <p>Completed stays and departures. These records are archived and kept for operational audits.</p>
    {historyStays.length===0?(
     <p style={{padding:"16px",color:"var(--muted)"}}>No checkout history in this view.</p>
    ):(
     <div className="platform-table">
      <table>
       <thead>
        <tr>
         <th>Guest</th>
         <th>Property &amp; Room</th>
         <th>Dates</th>
         <th>State</th>
         <th>Feedback</th>
        </tr>
       </thead>
       <tbody>
        {historyStays.map((s:any)=>(
         <tr key={s.id}>
          <td><strong>{s.guests?.full_name||"Guest"}</strong></td>
          <td>{nameOf(s.property_id)}<small>Room {s.room_number}</small></td>
          <td>{s.check_in_date} → {s.check_out_date}</td>
          <td><span className="hotel-status">{label(s.status)}</span></td>
          <td>{s.feedback?.length>0?s.feedback.map((f:any)=>f.rating+"/5 · "+label(f.status)).join(", "):"—"}</td>
         </tr>
        ))}
       </tbody>
      </table>
     </div>
    )}
   </section>
  )}

  {/* DIRECTORY / PROFILES */}
  {guestTab==="profiles"&&<>
   {canManage&&<section className="platform-card">
    <h2>{guest?"Edit guest":"Add guest profile"}</h2>
    <fieldset className="hotel-form-lock" disabled={busy}>
     <GuestForm guest={guest} save={save} cancel={()=>setGuest(null)}/>
    </fieldset>
   </section>}
   <section className="platform-card">
    <h2>Guest directory</h2>
    <p>{canManage?"Latest 100 matching profiles. Search looks across the company directory.":"Guest details require guest PII permission and are limited to stays in this property view."}</p>
    <div className="platform-table">
     <table>
      <thead>
       <tr>
        <th>Guest</th>
        <th>Contact</th>
        <th>Tier</th>
        <th>Preferences</th>
        <th style={{textAlign:"right"}}>Action</th>
       </tr>
      </thead>
      <tbody>
       {data.guests.map((g:any)=>(
        <tr key={g.id}>
         <td>{g.full_name}</td>
         <td>{g.email||"—"}<small>{g.phone||""}</small></td>
         <td>{g.vip_tier}</td>
         <td className="hotel-wrap">{g.preferences||"—"}</td>
         <td style={{textAlign:"right"}}>{canManage&&<button className="button button-outline compact" onClick={()=>{setGuest(g);window.scrollTo({top:0,behavior:"smooth"});}}>Edit</button>}</td>
        </tr>
       ))}
      </tbody>
     </table>
     {!data.guests.length&&<p>No matching guest profiles.</p>}
    </div>
   </section>
  </>}
 </>}

 {tab==="Rooms"&&<>
  <section className="platform-card" style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:"14px",marginBottom:"20px"}}>
   <div>
    <h2 style={{margin:"0 0 4px 0",fontSize:"15px"}}>Room Setup &amp; Bulk Import</h2>
    <p style={{margin:0,fontSize:"12px",color:"var(--muted)"}}>Add multiple rooms at once, batch generate floors, or drag and drop your CSV template to automatically configure your inventory.</p>
   </div>
   <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
    <button
     type="button"
     className="button button-dark compact"
     onClick={()=>{
      setRoomManagerPropertyId(property!=="all"?property:"");
      setShowRoomManagerModal(true);
     }}
     style={{display:"inline-flex",alignItems:"center",gap:"5px"}}
    >
     <Upload size={13}/>
     <span>Bulk CSV Import (Drag &amp; Drop)</span>
    </button>
    <button
     type="button"
     className="button button-outline compact"
     onClick={()=>{
      setRoomManagerPropertyId(property!=="all"?property:"");
      setShowRoomManagerModal(true);
     }}
     style={{display:"inline-flex",alignItems:"center",gap:"5px"}}
    >
     <Layers size={13}/>
     <span>Batch Floor Generator</span>
    </button>
   </div>
  </section>
  {canManage&&<section className="platform-card">
   <h2>Add a room</h2>
   <p>Add specific rooms, suites, and keys for this property with type, floor, view, and readiness state.</p>
   <form className="platform-fields" onSubmit={submit("room")}>
    <label>Property{propertySelect()}</label>
    <label>Room number<input name="room_number" maxLength={30} placeholder="e.g. 101, 204, Suite A" required/></label>
    <label>Room type
     <WorkspaceSelect
      label="Room type"
      name="room_type"
      defaultValue="Standard"
      options={[
       {value:"Standard",label:"Standard Room"},
       {value:"Deluxe",label:"Deluxe Room"},
       {value:"Superior",label:"Superior Room"},
       {value:"Executive Suite",label:"Executive Suite"},
       {value:"Junior Suite",label:"Junior Suite"},
       {value:"Presidential Suite",label:"Presidential Suite"},
       {value:"Villa",label:"Villa / Bungalow"},
       {value:"Penthouse",label:"Penthouse"}
      ]}
     />
    </label>
    <label>View · optional<input name="view" maxLength={60} placeholder="e.g. Ocean View, City View, Garden View"/></label>
    <label>Floor<input name="floor" maxLength={30} placeholder="e.g. 1, 2, G"/></label>
    <label>Capacity<input name="capacity" type="number" min={1} max={20} defaultValue={2} required/></label>
    <label>Initial state<WorkspaceSelect label="Initial room state" name="status" defaultValue="clean" options={stateOptions(["clean","dirty","out_of_service"])}/></label>
    <button className="button button-dark" disabled={busy}>Add room</button>
   </form>
  </section>}
  <section className="platform-card">
   <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"6px"}}>
    <h2 style={{margin:0}}>Room readiness &amp; inventory</h2>
    <span style={{fontSize:"12px",color:"var(--muted)"}}>{data.rooms.length} room{data.rooms.length===1?"":"s"}</span>
   </div>
   <p>Up to 200 rooms. A passing inspection marks a room inspected; checkout marks it dirty.</p>
   <div className="platform-table">
    <table>
     <thead>
      <tr>
       <th>Room</th>
       <th>Property</th>
       <th>Type / capacity</th>
       <th>Readiness</th>
       <th>Current stay</th>
       <th>Update state</th>
       <th style={{textAlign:"right"}}>Feedback QR</th>
      </tr>
     </thead>
     <tbody>
      {data.rooms.map((r:any)=>{
       const currentActiveStay=data.stays.find((s:any)=>s.room_id===r.id&&s.status==="active");
       return <tr key={r.id}>
        <td><strong>{r.room_number}</strong><small>Floor {r.floor||"—"}</small></td>
        <td>{nameOf(r.property_id)}</td>
        <td>{r.room_type} · {r.capacity} pax</td>
        <td><span className={"hotel-status "+r.status}>{label(r.status)}</span></td>
        <td>
         {currentActiveStay?(
          <strong style={{color:"var(--sage-deep)"}}>{currentActiveStay.guests?.full_name||"Occupied"}</strong>
         ):(
          <span style={{color:"var(--muted)"}}>Vacant</span>
         )}
        </td>
        <td>
         <WorkspaceSelect
          label={"Update room "+r.room_number}
          disabled={busy||!canManage}
          value={r.status}
          options={stateOptions([...r.status==="inspected"?["inspected"]:[],"clean","dirty","out_of_service"])}
          onChange={status=>{if(status!==r.status)save({action:"room",id:r.id,status,notes:r.notes},"PATCH");}}
         />
        </td>
        <td style={{textAlign:"right"}}>
         <button
          type="button"
          className="button button-outline compact"
          onClick={()=>showRoomQr(r)}
          style={{fontSize:"11px",padding:"3px 8px",display:"inline-flex",alignItems:"center",gap:"4px"}}
          title="Generate feedback code / QR for this room"
         >
          <QrCode size={12}/>
          <span>QR / Feedback</span>
         </button>
        </td>
       </tr>;
      })}
     </tbody>
    </table>
   </div>
  </section>
 </>}

 {tab==="Service jobs"&&<>
  {canCreateJob&&<section className="platform-card">
   <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"10px"}}>
    <h2 style={{margin:0}}>Dispatch a service job</h2>
    <span style={{fontSize:"12px",color:"var(--muted)"}}>Create guest requests, cleaning, or repairs</span>
   </div>
   <p>New jobs use your configured response target when no deadline is specified.</p>
   <fieldset className="hotel-form-lock" disabled={busy}>
    <JobForm
     data={data}
     save={save}
     initialProperty={property!=="all"?property:""}
     onOpenRoomManager={pId=>{setRoomManagerPropertyId(pId);setShowRoomManagerModal(true);}}
    />
   </fieldset>
  </section>}
  <section className="platform-card">
   <h2>Service board</h2>
   <p>{jobView==="active"?"Earliest 100 active jobs by deadline.":"Latest 100 closed jobs by deadline."} Closed jobs retain their history.</p>
   <div className="platform-table">
    <table>
     <thead>
      <tr>
       <th>Job</th>
       <th>Property / room</th>
       <th>Owner</th>
       <th>Deadline</th>
       <th>State</th>
       <th>Actions</th>
      </tr>
     </thead>
     <tbody>
      {data.jobs.map((j:any)=><tr key={j.id}>
       <td>{j.title}<small>{label(j.kind)} · {j.priority}</small></td>
       <td>{nameOf(j.property_id)}<small>Room {roomOf(j.room_id)}</small></td>
       <td>{canManage&&["open","in_progress"].includes(j.status)?<WorkspaceSelect label={"Assign "+j.title} disabled={busy} value={j.assigned_to||""} placeholder={j.assignee?.full_name||"Unassigned"} options={[{value:"",label:"Unassigned"},...data.team.filter((p:any)=>j.property_id?(p.property_id===j.property_id||(Array.isArray(p.property_ids)&&p.property_ids.includes(j.property_id))):true).map((p:any)=>({value:p.id,label:p.full_name}))]} onChange={assigned_to=>save({action:"job",id:j.id,assigned_to},"PATCH")}/>:j.assignee?.full_name||"Unassigned"}</td>
       <td>{format(j.due_at)}<small>{j.escalated_at?"Escalation queued":Date.parse(j.due_at)<Date.now()&&["open","in_progress"].includes(j.status)?"Overdue":""}</small></td>
       <td>{label(j.status)}</td>
       <td>{(canManage||canAttend&&j.assigned_to===user.id)&&["open","in_progress"].includes(j.status)&&<div className="platform-actions">{j.status==="open"&&<button className="button button-ghost compact" disabled={busy} onClick={()=>save({action:"job",id:j.id,status:"in_progress"},"PATCH")}>Start</button>}<button className="button button-dark compact" disabled={busy} onClick={()=>save({action:"job",id:j.id,status:"completed"},"PATCH")}>Complete</button>{canManage&&<button className="button button-ghost compact" disabled={busy} onClick={()=>save({action:"job",id:j.id,status:"cancelled"},"PATCH")}>Cancel job</button>}</div>}</td>
      </tr>)}
     </tbody>
    </table>
   </div>
  </section>
 </>}

 {tab==="Inspections"&&<>{canManage&&<section className="platform-card"><h2>Room inspection</h2><p>Mark only checks that passed. Any failed check creates a maintenance follow-up.</p><form onSubmit={async e=>{e.preventDefault();const form=e.currentTarget,fields=new FormData(form);if(await save({action:"inspection",room_id:inspectionRoom,notes:fields.get("notes"),answers:config.inspectionChecklist.map((check,i)=>({label:check,passed:fields.get("check-"+i)==="on"}))})){form.reset();setInspectionRoom("");}}}><label className="hotel-inspection-room">Room<WorkspaceSelect label="Inspection room" value={inspectionRoom} onChange={setInspectionRoom} placeholder="Choose room" options={roomOptions}/></label><div className="hotel-inspection-checks" key={inspectionRoom}>{config.inspectionChecklist.map((check,i)=><label key={check} className="hotel-check-label"><input name={"check-"+i} type="checkbox"/>{check}</label>)}</div><label>Inspection notes<textarea key={inspectionRoom} name="notes" rows={3} maxLength={2000}/></label><button className="button button-dark" disabled={busy||!inspectionRoom}>Record inspection</button></form></section>}<section className="platform-card"><h2>Inspection records</h2><p>Latest 100 inspections. These records cannot be edited after submission.</p>{data.inspections.map((i:any)=><details key={i.id}><summary>Room {roomOf(i.room_id)} · {i.passed?"Passed":"Follow-up required"} · {format(i.created_at)}</summary><ul>{i.answers.map((a:any)=><li key={a.label}>{a.passed?"Passed":"Failed"} · {a.label}</li>)}</ul>{i.notes&&<p>{i.notes}</p>}</details>)}</section></>}
 {tab==="Cost controls"&&canManage&&<><section className="platform-card"><h2>Companywide monthly budget</h2><p>{month} · All properties · Pending decisions reserve budget immediately.</p><div className="platform-stats">{[["Hard limit",data.budget.limit],["Approved",data.budget.approved],["Pending",data.budget.pending],["Remaining",data.budget.remaining]].map(([title,amount])=><article key={String(title)} className="platform-stat"><span>{title}</span><strong className="hotel-money">{money(Number(amount),data.budget.currency)}</strong></article>)}</div>{data.budget.limit===0&&<p className="platform-notice">Costs are blocked until an administrator sets positive monthly and per-expense limits in Settings.</p>}</section>
 <section className="platform-card"><h2>Record an operating cost</h2><p>Records current-month spending only. Select the current month to add an expense. Amounts above the auto-approval threshold need an explicit decision.</p><form className="platform-fields" onSubmit={submit("cost")}><label>Property{propertySelect()}</label><label>Category<WorkspaceSelect name="category" label="Cost category" defaultValue="supplies" options={stateOptions(["supplies","maintenance","guest_recovery","other"])}/></label><label>Amount · {config.currency}<input name="amount" inputMode="decimal" pattern="[0-9]+([.][0-9]{1,2})?" required/></label><label className="hotel-wide-field">Description<input name="description" maxLength={300} required/></label><button className="button button-dark" disabled={busy||!config.monthlyBudgetMinor||!config.perExpenseLimitMinor||month!==new Date().toISOString().slice(0,7)}>Record cost</button></form></section>
 <section className="platform-card"><h2>Cost approvals &amp; ledger</h2><p>Latest 100 entries for the selected property and month. Final decisions are retained.</p><div className="platform-table"><table><thead><tr><th>Description</th><th>Property</th><th>Amount</th><th>Date</th><th>State</th><th>Decision</th></tr></thead><tbody>{data.costs.map((c:any)=><tr key={c.id}><td>{c.description}<small>{label(c.category)}</small></td><td>{nameOf(c.property_id)}</td><td>{money(Number(c.amount_minor),c.currency)}</td><td>{c.expense_date}</td><td>{c.status}</td><td>{c.status==="pending"&&<div className="platform-actions"><button className="button button-dark compact" disabled={busy} onClick={()=>save({action:"cost",id:c.id,status:"approved"},"PATCH")}>Approve</button><button className="button button-ghost compact" disabled={busy} onClick={()=>save({action:"cost",id:c.id,status:"rejected"},"PATCH")}>Reject</button></div>}</td></tr>)}</tbody></table></div></section></>}
 </>}
 </>}

 {/* QUICK CREATE JOB MODAL */}
 <Modal
  open={showJobModal}
  title="Create Service Job Request"
  subtitle="Dispatch a housekeeping, maintenance, inspection, or guest request immediately."
  onClose={()=>setShowJobModal(false)}
 >
  {data?(
   <JobForm
    data={data}
    save={save}
    initialProperty={property!=="all"?property:""}
    onSuccess={()=>setShowJobModal(false)}
    onOpenRoomManager={pId=>{setRoomManagerPropertyId(pId);setShowRoomManagerModal(true);}}
   />
  ):(
   <p>Loading hotel operations…</p>
  )}
 </Modal>

 {/* RESERVE STAY MODAL */}
 <Modal
  open={showReserveModal}
  title="Reserve / Check In a Stay"
  subtitle="Assign a guest to an inspected room and set check-in / departure dates."
  onClose={()=>setShowReserveModal(false)}
 >
  {data?(
   <form className="platform-fields" onSubmit={async e=>{
    e.preventDefault();const form=e.currentTarget,fields=Object.fromEntries(new FormData(form));
    if(await save({action:"stay",...fields})){
     form.reset();
     setShowReserveModal(false);
    }
   }}>
    <label>Guest<WorkspaceSelect label="Reservation guest" name="guest_id" placeholder="Choose guest" options={data.guests.map((g:any)=>({value:g.id,label:g.full_name}))}/></label>
    <label>Room<WorkspaceSelect label="Reservation room" name="room_id" placeholder="Choose room" options={roomOptions}/></label>
    <label>Number of guests<input name="guest_count" type="number" min={1} max={20} defaultValue={1} required/></label>
    <label>Arrival<WorkspaceDateField name="check_in_date" label="Arrival" required/></label>
    <label>Departure<WorkspaceDateField name="check_out_date" label="Departure" required/></label>
    <div style={{display:"flex",justifyContent:"flex-end",gap:"8px",marginTop:"14px",gridColumn:"span 2"}}>
     <button type="button" className="button button-outline" onClick={()=>setShowReserveModal(false)}>Cancel</button>
     <button className="button button-dark" disabled={busy}>Confirm reservation</button>
    </div>
   </form>
  ):(
   <p>Loading...</p>
  )}
 </Modal>

 {/* FEEDBACK CODE / QR MODAL */}
 <QrModal
  item={qrModalData}
  onClose={()=>setQrModalData(null)}
 />

 {/* ROOM MANAGER MODAL (Bulk CSV Drag & Drop, Batch Floor Generator, Single Room) */}
 <RoomManagerModal
  open={showRoomManagerModal}
  onClose={()=>{setShowRoomManagerModal(false);load();}}
  properties={data?.properties||[]}
  selectedPropertyId={roomManagerPropertyId||(property!=="all"?property:"")}
  onRoomsUpdated={load}
 />

 </div></AppShell>;
}
