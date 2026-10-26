"use client";

import {useState} from "react";
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
}

export default function WorkspaceSelect({name,value,defaultValue="",onChange,options,placeholder,label,disabled,floating=true}:WorkspaceSelectProps){
 const [internalValue,setInternalValue]=useState(defaultValue);
 const selected=value??internalValue;
 return <div className="workspace-select">
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
