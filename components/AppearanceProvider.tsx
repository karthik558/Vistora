"use client";
import {createContext,useContext,useEffect,useState} from "react";
import {DEFAULT_HOSPITALITY,hospitalityConfig,HospitalityConfig} from "../lib/hospitality/config";
const AppearanceContext=createContext({config:DEFAULT_HOSPITALITY,dark:false,update:(_value:HospitalityConfig)=>{}});
export function useAppearance(){return useContext(AppearanceContext);}
export default function AppearanceProvider({initial,children}:{initial:HospitalityConfig;children:React.ReactNode}){
 const [config,setConfig]=useState(hospitalityConfig(initial)),[dark,setDark]=useState(false);
 useEffect(()=>{
  const sync=()=>setDark(document.documentElement.dataset.theme==="dark");sync();
  const observer=new MutationObserver(sync);observer.observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});
  return()=>observer.disconnect();
 },[]);
 return <AppearanceContext.Provider value={{config,dark,update:setConfig}}>{children}</AppearanceContext.Provider>;
}
