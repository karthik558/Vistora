"use client";

import {useEffect} from "react";

/** Applies the saved theme after hydration without injecting an inline script into the RSC tree. */
export default function ThemeInitializer(){
 useEffect(()=>{
  try{
   const theme=localStorage.getItem("vistora-theme")==="dark"?"dark":"light";
   document.documentElement.setAttribute("data-theme",theme);
  }catch{}
 },[]);
 return null;
}