"use client";

import {useEffect,useRef,useState} from "react";
import {ShieldCheck,UserRound,X} from "lucide-react";

export default function WorkspaceAccount({name,email,admin}:{name:string;email:string;admin:boolean}){
 const [open,setOpen]=useState(false);
 const root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),close=useRef<HTMLButtonElement>(null);
 const initials=name.trim().split(/\s+/).slice(0,2).map(part=>part[0]).join("").toUpperCase();
 useEffect(()=>{
  if(!open)return;
  close.current?.focus();
  const outside=(event:MouseEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false);};
  const escape=(event:KeyboardEvent)=>{if(event.key==="Escape"){setOpen(false);trigger.current?.focus();}};
  document.addEventListener("click",outside);document.addEventListener("keydown",escape);
  return()=>{document.removeEventListener("click",outside);document.removeEventListener("keydown",escape);};
 },[open]);
 return <div className="launcher-account" ref={root}>
  <button ref={trigger} type="button" className="launcher-avatar" aria-label={`Account details for ${name}${admin?", administrator":""}`} aria-expanded={open} aria-controls="workspace-account-details" aria-haspopup="dialog" onClick={()=>setOpen(value=>!value)}>
   <span aria-hidden="true">{initials}</span><span className="launcher-avatar-badge" aria-hidden="true">{admin?<ShieldCheck size={10}/>:<UserRound size={10}/>}</span>
  </button>
  {open&&<section id="workspace-account-details" className="launcher-account-popover" role="dialog" aria-label="Account details">
   <div className="launcher-account-popover-heading"><span>Signed in</span><button ref={close} type="button" aria-label="Close account details" onClick={()=>{setOpen(false);trigger.current?.focus();}}><X size={15}/></button></div>
   <strong>{name}</strong><p>{email}</p><span className="launcher-account-role">{admin?<ShieldCheck size={13}/>:<UserRound size={13}/>} {admin?"Workspace administrator":"Workspace member"}</span>
  </section>}
 </div>;
}
