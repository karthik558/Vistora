"use client";

import {useEffect,useRef,useState} from "react";
import CustomSelect, {SelectOption} from "./CustomSelect";

interface WorkspaceSelectProps {
 name?:string;
 value?:string;
 defaultValue?:string;
 onChange?:(value:string)=>void;
 options:SelectOption[];
 placeholder?:string;
 label:string;
 disabled?:boolean;
 floating?:boolean;
 required?:boolean;
}

export default function WorkspaceSelect({name,value,defaultValue="",onChange,options,placeholder,label,disabled,floating=true,required=false}:WorkspaceSelectProps){
 const [internalValue,setInternalValue]=useState(defaultValue);
 const selected=value??internalValue;
 const container=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const form=container.current?.closest("form");
  const reset=()=>setInternalValue(defaultValue);
  form?.addEventListener("reset",reset);
  return ()=>form?.removeEventListener("reset",reset);
 },[defaultValue]);
 return <div className="workspace-select" ref={container} style={{position:"relative"}}>
  {required&&<input aria-label={label+" selection"} tabIndex={-1} required disabled={disabled}
   value={selected} onChange={()=>{}} onInvalid={()=>container.current?.querySelector("button")?.focus()}
   style={{position:"absolute",opacity:0,width:1,height:1,padding:0,border:0,pointerEvents:"none"}}/>}
  {name&&<input type="hidden" name={name} value={selected}/>}
  <CustomSelect
   value={selected} options={options} placeholder={placeholder} header={label}
   ariaLabel={label} disabled={disabled} floating={floating}
   onChange={next=>{setInternalValue(next);onChange?.(next);}}
   triggerStyle={{minHeight:36,padding:"7px 10px",borderRadius:4,fontSize:12}}
   popoverStyle={{borderRadius:5,maxHeight:240}}
  />
 </div>;
}
