"use client";
import {useEffect,useRef,useState} from "react";
import CustomDatePicker from "./CustomDatePicker";
export default function WorkspaceDateField({name,label,mode="date",required=false,value,onChange,minDate}:{name?:string;label:string;mode?:"date"|"datetime"|"month";required?:boolean;value?:string;onChange?:(value:string)=>void;minDate?:string}){
 const [date,setDate]=useState(""),[time,setTime]=useState("09:00"),[invalid,setInvalid]=useState(false),root=useRef<HTMLDivElement>(null);
 const selected=value===undefined?date:mode==="month"&&value?value+"-01":value;
 const serialized=selected?mode==="datetime"?selected+"T"+time:mode==="month"?selected.slice(0,7):selected:"";
 useEffect(()=>{const form=root.current?.closest("form"),reset=()=>{setDate("");setTime("09:00");setInvalid(false);};form?.addEventListener("reset",reset);return()=>form?.removeEventListener("reset",reset);},[]);
 return <div className="workspace-date-field" ref={root}>
  <CustomDatePicker label={label} selectionMode={mode==="month"?"month":"single"} floating minDate={minDate} value={{preset:selected?"custom":"all",startDate:selected||null,endDate:selected||null}} onChange={next=>{const date=next.startDate||"";setDate(date);setInvalid(false);onChange?.(mode==="month"?date.slice(0,7):mode==="datetime"&&date?date+"T"+time:date);}}/>
  {mode==="datetime"&&<input aria-label={label+" time"} type="time" required={!!selected} value={time} onChange={e=>{setTime(e.target.value);onChange?.(selected&&e.target.value?selected+"T"+e.target.value:"");}}/>}
  {selected&&!required&&mode!=="month"&&<button type="button" className="date-field-clear" aria-label={"Clear "+label.toLowerCase()} onClick={()=>{setDate("");setInvalid(false);onChange?.("");}}>Clear</button>}
  {name&&<input className="date-field-validity" aria-label={label+" value"} name={name} value={serialized} onChange={()=>{}} required={required} tabIndex={-1} onInvalid={event=>{event.preventDefault();setInvalid(true);root.current?.querySelector("button")?.focus();}}/>}
  {invalid&&<small role="alert">Choose {label.toLowerCase()}.</small>}
 </div>;
}
