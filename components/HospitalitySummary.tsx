"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {useAppearance} from "./AppearanceProvider";
export default function HospitalitySummary({property="all"}:{property?:string}){
 const [metrics,setMetrics]=useState<any>(null),[error,setError]=useState("");
 const {config}=useAppearance();
 useEffect(()=>{const controller=new AbortController();setError("");fetch("/api/hospitality?"+new URLSearchParams({summary:"true",property}),{signal:controller.signal}).then(async r=>{const json=await r.json();if(!r.ok)throw new Error(json.error);setMetrics(json.metrics);}).catch(e=>{if(e.name!=="AbortError")setError(e.message);});return()=>controller.abort();},[property]);
 if(error)return <section className="hotel-summary-notice"><span>{error}</span><Link href="/dashboard/hospitality">View hotel operations</Link></section>;
 if(!metrics)return null;
 return <section className="hotel-summary-grid" aria-label="Hotel operations snapshot">{[
  {title:"In-house stays",key:"inHouse",section:"Guests",color:config.colors.guests},
  {title:"Rooms needing service",key:"roomsNeedService",section:"Rooms",color:config.colors.property},
  {title:"Open service jobs",key:"openJobs",section:"Service jobs",color:config.colors.operations},
  {title:"Pending cost approvals",key:"pendingCosts",section:"Cost controls",color:config.colors.operations}
 ].map(card=><Link key={card.key} href={"/dashboard/hospitality?"+new URLSearchParams({section:card.section,property})} style={{borderTopColor:card.color}}><span>{card.title}</span><strong>{metrics[card.key]}</strong><small>Open {card.section.toLowerCase()}</small></Link>)}</section>;
}
