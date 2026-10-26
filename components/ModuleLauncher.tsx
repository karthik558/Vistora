"use client";
import Link from "next/link";
import Image from "next/image";
import {useRouter} from "next/navigation";
import {useState} from "react";
import {ArrowRight,Building2,MessageSquare,LogOut,Settings,Users} from "lucide-react";
import type {WorkspaceUser} from "./Dashboard";
import ThemeToggle from "./ThemeToggle";
import {useAppearance} from "./AppearanceProvider";
import {themedAccentTokens} from "../lib/hospitality/config";
import {hasModuleAccess} from "../lib/auth/modules";
import {canOpenSettings,canOpenTeam} from "../lib/auth/administration";

export default function ModuleLauncher({user}:{user:WorkspaceUser}){
 const {config}=useAppearance(),router=useRouter();
 const [error,setError]=useState(""),[busy,setBusy]=useState(false);
 const feedbackAccess=hasModuleAccess(user,"feedback")&&(user.isOrganizationAdmin||user.rights?.some(right=>["view_feedback","manage_complaints","manage_questionnaire","export_reports","view_audit_log"].includes(right)));
 const hotelAccess=hasModuleAccess(user,"hospitality");
 const feedbackHref=user.isOrganizationAdmin||user.rights?.includes("view_feedback")?"/dashboard/overview":user.rights?.includes("manage_complaints")?"/dashboard/complaints":user.rights?.includes("manage_questionnaire")?"/dashboard/forms":user.rights?.includes("export_reports")?"/dashboard/reports":"/dashboard/audit-log";
 async function logout(){
  setBusy(true);setError("");
  try{const response=await fetch("/api/auth/logout",{method:"POST"});if(!response.ok)throw new Error("Could not sign out. Try again.");localStorage.removeItem("vistora-user");router.replace("/login");router.refresh();}
  catch(error){setError((error as Error).message);setBusy(false);}
 }
 return <main className="module-launcher">
  <header className="module-launcher-header"><Link href="/dashboard" aria-label="Vistora modules" style={{ display: "inline-flex", alignItems: "center" }}><Image src="/vistora_wordmark_green.webp" alt="Vistora" width={134} height={32} className="brand-logo-light" priority/><Image src="/vistora_wordmark_white.webp" alt="Vistora" width={134} height={32} className="brand-logo-dark" priority/></Link><div><span>{user.fullName||user.email}</span><ThemeToggle/><button className="button button-ghost" onClick={logout} disabled={busy} aria-label="Sign out"><LogOut size={16}/></button></div></header>
  <section className="module-launcher-content"><p className="eyebrow">YOUR WORKSPACE</p><h1>Choose your module</h1><p className="module-launcher-intro">Where would you like to work today?</p>
   {error&&<p role="alert">{error}</p>}
   <div className="module-launcher-grid">
    {feedbackAccess&&<Link href={feedbackHref} className="module-launcher-card" style={themedAccentTokens(config.colors.feedback)}><div className="module-card-visual"><MessageSquare size={36} strokeWidth={1.5}/><span>GUEST EXPERIENCE</span></div><div className="module-card-copy"><h2>Feedback</h2><p>Guest feedback, ratings, analytics and service recovery.</p><span className="module-card-action">Open feedback<ArrowRight size={17}/></span></div></Link>}
    {hotelAccess&&<Link href="/dashboard/hospitality" className="module-launcher-card" style={themedAccentTokens(config.colors.property)}><div className="module-card-visual"><Building2 size={36} strokeWidth={1.5}/><span>PROPERTY &amp; SERVICE</span></div><div className="module-card-copy"><h2>Hotel operations</h2><p>Guest stays, room readiness, service jobs and inspections.</p><span className="module-card-action">Open hotel operations<ArrowRight size={17}/></span></div></Link>}
   </div>
   {!feedbackAccess&&!hotelAccess&&<p className="platform-notice">No modules are assigned to your account. Contact your administrator.</p>}
   {(canOpenSettings(user)||canOpenTeam(user))&&<section className="launcher-administration" aria-labelledby="launcher-administration-title">
    <h2 id="launcher-administration-title">Workspace administration</h2>
    <div className="launcher-administration-grid">
     {canOpenTeam(user)&&<Link href="/dashboard/users" className="launcher-administration-card"><Users size={21} strokeWidth={1.75}/><div><h3>Team &amp; users</h3><p>Members, module access and property permissions.</p></div><ArrowRight size={16}/></Link>}
     {canOpenSettings(user)&&<Link href="/dashboard/settings" className="launcher-administration-card"><Settings size={21} strokeWidth={1.75}/><div><h3>Settings</h3><p>Company preferences, branding and module configuration.</p></div><ArrowRight size={16}/></Link>}
    </div>
   </section>}
  </section><footer className="module-launcher-footer">© 2026 Vistora. All rights reserved.</footer>
 </main>;
}
