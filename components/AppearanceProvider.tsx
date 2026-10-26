"use client";
import {createContext,useContext,useEffect,useState} from "react";
import {DEFAULT_HOSPITALITY,hospitalityConfig,HospitalityConfig} from "../lib/hospitality/config";
import {usePathname,useSearchParams} from "next/navigation";
const AppearanceContext=createContext({config:DEFAULT_HOSPITALITY,dark:false,update:(_value:HospitalityConfig)=>{}});
export function useAppearance(){return useContext(AppearanceContext);}
export default function AppearanceProvider({initial,children}:{initial:HospitalityConfig;children:React.ReactNode}){
 const [config,setConfig]=useState(hospitalityConfig(initial)),[dark,setDark]=useState(false);
 const path=usePathname(),query=useSearchParams().toString();
 useEffect(()=>{
  try{const saved=localStorage.getItem("vistora-theme");if(saved==="dark"||saved==="light")document.documentElement.dataset.theme=saved;}catch{}
  const sync=()=>setDark(document.documentElement.dataset.theme==="dark");sync();
  const observer=new MutationObserver(sync);observer.observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});
  return()=>observer.disconnect();
 },[]);
 useEffect(()=>{
  const shell=document.querySelector(".app-shell"),color=shell?getComputedStyle(shell).getPropertyValue("--module-accent"):config.colors.feedback;
  document.documentElement.style.setProperty("--scroll-thumb",color);
  return()=>{document.documentElement.style.removeProperty("--scroll-thumb");};
 },[config,dark,path,query]);
 return <AppearanceContext.Provider value={{config,dark,update:setConfig}}>{children}</AppearanceContext.Provider>;
}
