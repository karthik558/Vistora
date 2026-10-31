import {redirect} from "next/navigation";
import {serverUser} from "../../../lib/platform/server-session";
import {canOpenAuditLog,canOpenReports,canOpenSettings,canOpenTeam,canOpenProperties,canOpenWorkspace} from "../../../lib/auth/administration";
import AdministrationWorkspace from "../../../components/AdministrationWorkspace";

export default async function AdministrationPage({searchParams}:{searchParams:Promise<{adminSection?:string}>}){
 const user=await serverUser();if(!user)redirect("/login");
 const {adminSection="reports"}=await searchParams;
 if(adminSection==="reports"&&!canOpenReports(user))redirect("/dashboard");
 if(adminSection==="audit-log"&&!canOpenAuditLog(user))redirect("/dashboard");
 if(adminSection==="workspace"&&!canOpenWorkspace(user))redirect("/dashboard");
 if(adminSection==="users"&&!canOpenTeam(user))redirect("/dashboard");
 if(adminSection==="settings"&&!canOpenSettings(user))redirect("/dashboard");
 if(adminSection==="properties"&&!canOpenProperties(user))redirect("/dashboard");
 if(adminSection==="role-mapping"&&!user.isOrganizationAdmin)redirect("/dashboard");
 if(!["reports","audit-log","workspace","users","settings","properties","role-mapping"].includes(adminSection))redirect("/dashboard");
 return <AdministrationWorkspace user={user} initialSection={adminSection}/>;
}