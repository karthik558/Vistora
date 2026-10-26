"use client";
import Link from "next/link";
import Image from "next/image";
import {useRouter} from "next/navigation";
import {useState} from "react";
import {ArrowRight,Building2,MessageSquare,LogOut} from "lucide-react";
import type {WorkspaceUser} from "./Dashboard";
import ThemeToggle from "./ThemeToggle";
import {useAppearance} from "./AppearanceProvider";
import {accentTokens} from "../lib/hospitality/config";

export default function ModuleLauncher({user}:{user:WorkspaceUser}){
 const {config,dark}=useAppearance(),router=useRouter();
 const [error,setError]=useState(""),[busy,setBusy]=useState(false);
 const feedbackAccess=user.isOrganizationAdmin||user.rights?.some(right=>["view_feedback","manage_complaints","manage_questionnaire","export_reports"].includes(right));
 const feedbackHref=user.isOrganizationAdmin||user.rights?.includes("view_feedback")?"/dashboard/overview":user.rights?.includes("manage_complaints")?"/dashboard/complaints":user.rights?.includes("manage_questionnaire")?"/dashboard/forms":"/dashboard/reports";
 async function logout(){
  setBusy(true);setError("");
  try{const response=await fetch("/api/auth/logout",{method:"POST"});if(!response.ok)throw new Error("Could not sign out. Try again.");localStorage.removeItem("vistora-user");router.replace("/login");router.refresh();}
  catch(error){setError((error as Error).message);setBusy(false);}
 }
 return <main className="module-launcher">
  <header className="module-launcher-header"><Link href="/dashboard" aria-label="Vistora modules"><Image src="/logo1.webp" alt="Vistora" width={134} height={36} priority/></Link><div><span>{user.fullName||user.email}</span><ThemeToggle/><button className="button button-ghost" onClick={logout} disabled={busy} aria-label="Sign out"><LogOut size={16}/></button></div></header>
  <section className="module-launcher-content"><p className="eyebrow">YOUR WORKSPACE</p><h1>Choose your module</h1><p className="module-launcher-intro">Where would you like to work today?</p>
   {error&&<p role="alert">{error}</p>}
   <div className="module-launcher-grid">
    {feedbackAccess&&<Link href={feedbackHref} className="module-launcher-card" style={accentTokens(config.colors.feedback,dark)}><div className="module-card-visual"><MessageSquare size={36} strokeWidth={1.5}/><span>GUEST EXPERIENCE</span></div><div className="module-card-copy"><h2>Feedback</h2><p>Guest feedback, ratings, analytics and service recovery.</p><span className="module-card-action">Open feedback<ArrowRight size={17}/></span></div></Link>}
    {user.isOrganizationAdmin&&<Link href="/dashboard/hospitality" className="module-launcher-card" style={accentTokens(config.colors.property,dark)}><div className="module-card-visual"><Building2 size={36} strokeWidth={1.5}/><span>PROPERTY &amp; SERVICE</span></div><div className="module-card-copy"><h2>Hotel operations</h2><p>Guest stays, room readiness, service jobs and inspections.</p><span className="module-card-action">Open hotel operations<ArrowRight size={17}/></span></div></Link>}
   </div>
   {!feedbackAccess&&!user.isOrganizationAdmin&&<p className="platform-notice">No modules are assigned to your account. Contact your administrator.</p>}
  </section><footer className="module-launcher-footer">Vistora · Your hospitality workspace</footer>
 </main>;
}
